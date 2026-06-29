import { randomUUID } from "crypto";

import { getPayload } from "payload";
import configPromise from "@payload-config";
import { z } from "zod";

import type { SrtFitSettings } from "@/lib/tts/client";
import {
  isValidSrt,
  parseSrt,
  totalChars,
  totalDurationMs,
  type SrtCue,
} from "@/lib/tts/srt";
import {
  getDefaultLanguageForEngine,
  isValidLanguageForEngine,
} from "@/lib/tts/languages";
import { resolveLimitsFromUser } from "@/lib/usage-limits";
import { withUserQuotaLock } from "@/lib/server/quota-lock";
import { spawnModalSrtJob } from "@/lib/server/modal-srt";
import {
  checkCharacterQuota,
  findWeeklyUsage,
  getWeekKey,
} from "@/lib/server/tts-quota";
import { resolveVoice } from "@/lib/server/tts-voice";
import {
  isModalEngineSource,
  MODAL_ENGINE_SOURCES,
  type ModalEngineSource,
} from "@/lib/voices";

export const runtime = "nodejs";

const fitSettingsSchema = z.object({
  maxSpeedup: z.coerce.number().min(1).max(4).default(2),
  mode: z.literal("compress_and_pad").default("compress_and_pad"),
});

const createJobSchema = z.object({
  srtText: z.string().min(1, "SRT content is required"),
  srtFilename: z.string().trim().min(1).max(255),
  engine: z.enum(MODAL_ENGINE_SOURCES),
  voiceId: z.string().trim().min(1),
  language: z.string().trim().optional(),
  fit: fitSettingsSchema.optional(),
});

function serializeJob(doc: Record<string, unknown>) {
  return {
    id: doc.id,
    status: doc.status,
    engine: doc.voiceSource,
    sourceVoiceId: doc.sourceVoiceId,
    voiceName: doc.voiceName,
    language: doc.language,
    srtFilename: doc.srtFilename,
    cuesTotal: doc.cuesTotal,
    cuesDone: doc.cuesDone,
    fitSettings: doc.fitSettings,
    warnings: doc.warnings ?? [],
    error: doc.error,
    generationId:
      typeof doc.generation === "number"
        ? doc.generation
        : doc.generation &&
            typeof doc.generation === "object" &&
            typeof (doc.generation as { id?: unknown }).id === "number"
          ? (doc.generation as { id: number }).id
          : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user || user.collection !== "users") {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          message: "Invalid request body",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { srtText, srtFilename, engine, voiceId, language, fit } =
      parsed.data;

    const parseResult = parseSrt(srtText);
    if (!isValidSrt(parseResult)) {
      return Response.json(
        {
          message: "Invalid SRT file",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 },
      );
    }

    const cues = parseResult.cues;
    const charCount = totalChars(cues);
    const timelineDurationMs = totalDurationMs(cues);
    const fitSettings: SrtFitSettings = {
      maxSpeedup: fit?.maxSpeedup ?? 2,
      mode: "compress_and_pad",
    };

    const selectedVoice = await resolveVoice(
      payload,
      user,
      engine as ModalEngineSource,
      voiceId,
    );

    if (!selectedVoice || !isModalEngineSource(selectedVoice.source)) {
      return Response.json(
        { message: "Unsupported or inactive voice selection" },
        { status: 400 },
      );
    }

    const resolvedLanguage =
      language && isValidLanguageForEngine(selectedVoice.source, language)
        ? language
        : getDefaultLanguageForEngine(selectedVoice.source);

    const limitSource = await payload.findByID({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      depth: 1,
      select: { tier: true },
    });

    const limits = resolveLimitsFromUser({ tier: limitSource.tier });
    const { weekStartISO, weekKey } = getWeekKey(user.id);

    const lockResult = await withUserQuotaLock(user.id, async () => {
      const usage = await findWeeklyUsage(payload, weekKey);
      const usedCharacterCount = usage?.usedCharacters ?? 0;

      const quotaCheck = checkCharacterQuota({
        usedCharacters: usedCharacterCount,
        requestedCharacters: charCount,
        weeklyLimit: limits.weeklyCharacterLimit,
        maxPerRequest: limits.maxCharactersPerRequest,
      });

      if (!quotaCheck.allowed) {
        return {
          quotaExceeded: true as const,
          reason: quotaCheck.reason,
          usedCharacterCount,
        };
      }

      const audioFilename = `srt-${randomUUID()}.wav`;

      const job = await payload.create({
        collection: "tts-srt-jobs",
        overrideAccess: true,
        data: {
          user: user.id,
          status: "pending",
          voiceSource: selectedVoice.source as "qwen" | "chatterbox",
          sourceVoiceId: selectedVoice.sourceVoiceId,
          voiceName: selectedVoice.name,
          voice: selectedVoice.id,
          language: resolvedLanguage,
          srtFilename,
          audioFilename,
          cuesTotal: cues.length,
          cuesDone: 0,
          fitSettings,
          warnings: parseResult.warnings,
          charCount,
          timelineDurationMs,
        },
        user,
      });

      try {
        const modalJob = await spawnModalSrtJob({
          engine: selectedVoice.source,
          voiceId: selectedVoice.sourceVoiceId,
          language: resolvedLanguage,
          cues,
          fit: fitSettings,
          jobId: String(job.id),
          outputFilename: audioFilename,
        });

        const updatedJob = await payload.update({
          collection: "tts-srt-jobs",
          id: job.id,
          overrideAccess: true,
          data: {
            status: "running",
            modalCallId: modalJob.call_id,
          },
          user,
        });

        return {
          quotaExceeded: false as const,
          job: updatedJob,
        };
      } catch (error) {
        await payload.update({
          collection: "tts-srt-jobs",
          id: job.id,
          overrideAccess: true,
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Failed to start job",
          },
          user,
        });
        throw error;
      }
    });

    if (lockResult.quotaExceeded) {
      return Response.json(
        {
          message:
            lockResult.reason === "per_request"
              ? `SRT exceeds per-request character limit (${limits.maxCharactersPerRequest.toLocaleString()})`
              : "Weekly character limit reached. Contact an admin to increase your quota.",
          limits: {
            characterLimit: limits.weeklyCharacterLimit,
            maxCharactersPerRequest: limits.maxCharactersPerRequest,
            usedCharacters: lockResult.usedCharacterCount,
            requestedCharacters: charCount,
            weekStart: weekStartISO,
          },
        },
        { status: 429 },
      );
    }

    return Response.json(
      {
        job: serializeJob(lockResult.job as unknown as Record<string, unknown>),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SRT Jobs POST Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export type { SrtCue };
