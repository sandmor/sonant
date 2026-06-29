import { getPayload } from "payload";
import configPromise from "@payload-config";
import { z } from "zod";

import { fetchModalSrtStatus } from "@/lib/server/modal-srt";
import { registerTtsAudioFromStorage } from "@/lib/server/tts-audio";
import {
  findWeeklyUsage,
  getWeekKey,
  upsertWeeklyUsage,
} from "@/lib/server/tts-quota";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function serializeJob(doc: Record<string, unknown>, generation?: Record<string, unknown>) {
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
    generationId: generation?.id,
    generation: generation
      ? {
          id: generation.id,
          title: generation.title,
          inputText: generation.inputText,
          voiceSource: generation.voiceSource,
          sourceVoiceId: generation.sourceVoiceId,
          voiceName: generation.voiceName,
          voiceLocale: generation.voiceLocale,
          audioMime: generation.audioMime,
          audioUrl: generation.audioUrl,
          audioByteLength: generation.audioByteLength,
          charCount: generation.charCount,
          createdAt: generation.createdAt,
          kind: generation.kind,
          srtFilename: generation.srtFilename,
          cuesTotal: generation.cuesTotal,
          timelineDurationMs: generation.timelineDurationMs,
        }
      : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function loadOwnedJob(req: Request, jobId: number) {
  const payload = await getPayload({ config: configPromise });
  const { user } = await payload.auth({ headers: req.headers });

  if (!user || user.collection !== "users") {
    return { payload, user: null, job: null };
  }

  const result = await payload.find({
    collection: "tts-srt-jobs",
    where: {
      and: [{ id: { equals: jobId } }, { user: { equals: user.id } }],
    },
    limit: 1,
    depth: 1,
    user,
  });

  return {
    payload,
    user,
    job: result.docs[0] ?? null,
  };
}

async function finalizeCompletedJob(
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: { id: number },
  job: Record<string, unknown>,
  status: Extract<Awaited<ReturnType<typeof fetchModalSrtStatus>>, { status: "completed" }>,
) {
  if (job.status === "completed" && job.generation) {
    const generation =
      typeof job.generation === "object" && job.generation !== null
        ? (job.generation as Record<string, unknown>)
        : null;

    if (generation) {
      const audio =
        generation.audio &&
        typeof generation.audio === "object" &&
        generation.audio !== null
          ? (generation.audio as { url?: string | null })
          : null;

      return serializeJob(job, {
        ...generation,
        audioUrl: audio?.url ?? null,
      });
    }
  }

  const audioFilename =
    typeof job.audioFilename === "string" && job.audioFilename.length > 0
      ? job.audioFilename
      : status.filename;
  const srtFilename =
    typeof job.srtFilename === "string" ? job.srtFilename : "subtitles.srt";
  const charCount = typeof job.charCount === "number" ? job.charCount : 1;
  const cuesTotal = typeof job.cuesTotal === "number" ? job.cuesTotal : 0;
  const timelineDurationMs =
    typeof job.timelineDurationMs === "number"
      ? job.timelineDurationMs
      : status.totalDurationMs;

  if (!audioFilename) {
    throw new Error("SRT job is missing audio filename");
  }

  if (status.filename && status.filename !== audioFilename) {
    throw new Error("Modal result filename does not match job audio filename");
  }

  const uploadDoc = await registerTtsAudioFromStorage(payload, {
    userId: user.id,
    filename: audioFilename,
    filesize: status.byteLength,
    user,
    deleteSourceAfterRegister: true,
  });

  const title = `${srtFilename.replace(/\.srt$/i, "")} · ${cuesTotal} cues`;

  const voiceId =
    typeof job.voice === "number"
      ? job.voice
      : job.voice &&
          typeof job.voice === "object" &&
          typeof (job.voice as { id?: unknown }).id === "number"
        ? (job.voice as { id: number }).id
        : undefined;

  if (!voiceId) {
    throw new Error("SRT job is missing voice relationship");
  }

  const generation = await payload.create({
    collection: "tts-generations",
    overrideAccess: true,
    data: {
      title,
      inputText: `[SRT] ${srtFilename}`,
      voice: voiceId,
      voiceSource: job.voiceSource as "qwen" | "chatterbox",
      sourceVoiceId: String(job.sourceVoiceId),
      voiceName: String(job.voiceName),
      voiceLocale: typeof job.language === "string" ? job.language : null,
      audio: uploadDoc.id,
      audioMime: status.mimeType,
      audioByteLength: status.byteLength,
      charCount,
      user: user.id,
      kind: "subtitles",
      srtFilename,
      cuesTotal,
      timelineDurationMs,
    },
    user,
  });

  const mergedWarnings = [
    ...(Array.isArray(job.warnings) ? job.warnings : []),
    ...status.warnings.map((warning) => ({
      cueIndex: warning.cueIndex,
      code: warning.code ?? "overrun_after_clamp",
      message: warning.message ?? "Cue fit warning",
    })),
  ];

  const { weekStartISO, weekKey } = getWeekKey(user.id);
  const usage = await findWeeklyUsage(payload, weekKey);
  const usedCharacterCount = usage?.usedCharacters ?? 0;
  const nextUsedCharacters = usedCharacterCount + charCount;

  await upsertWeeklyUsage(payload, {
    userID: user.id,
    weekStartISO,
    weekKey,
    usedCharacters: nextUsedCharacters,
    usageDocID: usage?.id,
  });

  const updatedJob = await payload.update({
    collection: "tts-srt-jobs",
    id: job.id as number,
    overrideAccess: true,
    data: {
      status: "completed",
      cuesDone: status.cuesTotal,
      warnings: mergedWarnings,
      generation: generation.id,
      error: null,
    },
    user,
    depth: 1,
  });

  return serializeJob(updatedJob as unknown as Record<string, unknown>, {
    ...generation,
    audioUrl:
      typeof uploadDoc.url === "string" && uploadDoc.url.length > 0
        ? uploadDoc.url
        : null,
  });
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const parsedParams = paramsSchema.safeParse(await ctx.params);
    if (!parsedParams.success) {
      return Response.json(
        { message: "Invalid job id", errors: parsedParams.error.flatten() },
        { status: 400 },
      );
    }

    const { payload, user, job } = await loadOwnedJob(req, parsedParams.data.id);

    if (!user) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!job) {
      return Response.json({ message: "Job not found" }, { status: 404 });
    }

    const jobRecord = job as unknown as Record<string, unknown>;

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      const generation =
        job.generation && typeof job.generation === "object"
          ? (job.generation as unknown as Record<string, unknown>)
          : undefined;

      const audioUrl =
        generation?.audio &&
        typeof generation.audio === "object" &&
        generation.audio !== null &&
        "url" in generation.audio &&
        typeof (generation.audio as { url?: unknown }).url === "string"
          ? (generation.audio as { url: string }).url
          : null;

      return Response.json({
        job: serializeJob(jobRecord, generation ? { ...generation, audioUrl } : undefined),
      });
    }

    if (!job.modalCallId) {
      return Response.json({
        job: serializeJob(jobRecord),
      });
    }

    const status = await fetchModalSrtStatus(job.modalCallId, String(job.id));

    if (status.status === "running") {
      const updatedJob = await payload.update({
        collection: "tts-srt-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "running",
          cuesDone: status.cuesDone,
        },
        user,
      });

      return Response.json({
        job: {
          ...serializeJob(updatedJob as unknown as Record<string, unknown>),
          ...(status.phase ? { phase: status.phase } : {}),
        },
      });
    }

    if (status.status === "failed") {
      const updatedJob = await payload.update({
        collection: "tts-srt-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "failed",
          cuesDone: status.cuesDone,
          error: status.error ?? "SRT job failed",
        },
        user,
      });

      return Response.json({
        job: serializeJob(updatedJob as unknown as Record<string, unknown>),
      });
    }

    const completedJob = await finalizeCompletedJob(
      payload,
      user,
      jobRecord,
      status,
    ).catch(async (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Audio uploaded but registration failed";

      const failedJob = await payload.update({
        collection: "tts-srt-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "failed",
          cuesDone: status.cuesTotal,
          error: `Audio uploaded but registration failed: ${message}`,
        },
        user,
      });

      return serializeJob(failedJob as unknown as Record<string, unknown>);
    });

    return Response.json({ job: completedJob });
  } catch (error) {
    console.error("SRT Job GET Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const parsedParams = paramsSchema.safeParse(await ctx.params);
    if (!parsedParams.success) {
      return Response.json(
        { message: "Invalid job id", errors: parsedParams.error.flatten() },
        { status: 400 },
      );
    }

    const { payload, user, job } = await loadOwnedJob(req, parsedParams.data.id);

    if (!user) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!job) {
      return Response.json({ message: "Job not found" }, { status: 404 });
    }

    if (job.status === "running" || job.status === "pending") {
      await payload.update({
        collection: "tts-srt-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "cancelled",
          error: "Cancelled by user",
        },
        user,
      });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("SRT Job DELETE Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
