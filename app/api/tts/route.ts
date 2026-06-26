import { randomUUID } from "crypto";

import { getPayload } from "payload";
import configPromise from "@payload-config";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import type { Engine, VoiceId } from "@aws-sdk/client-polly";
import { z } from "zod";

import {
  DEFAULT_VOICE_SOURCE,
  isModalEngineSource,
  modalVoiceSupportsSource,
  relationToForSource,
  VOICE_SOURCE_VALUES,
  type VoiceSource,
} from "@/lib/voices";
import {
  getDefaultLanguageForEngine,
  isValidLanguageForEngine,
} from "@/lib/tts/languages";
import {
  ABSOLUTE_MAX_TTS_REQUEST_CHARACTERS,
  getCurrentWeekStartUTC,
  resolveLimitsFromUser,
} from "@/lib/usage-limits";
import { withUserQuotaLock } from "@/lib/server/quota-lock";
import { runTTSSoftRetentionCleanupIfDue } from "@/lib/retention/tts-retention";

export const runtime = "nodejs";

const ttsRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Text is required")
    .max(
      ABSOLUTE_MAX_TTS_REQUEST_CHARACTERS,
      `Text must be ${ABSOLUTE_MAX_TTS_REQUEST_CHARACTERS.toLocaleString()} characters or fewer`,
    ),
  voiceSource: z
    .enum(VOICE_SOURCE_VALUES)
    .optional()
    .default(DEFAULT_VOICE_SOURCE),
  voiceId: z.string().trim().optional(),
  language: z.string().trim().optional(),
});

type VoiceRecord = {
  id: number;
  source: VoiceSource;
  sourceVoiceId: string;
  name: string;
  languageCode?: string;
  pollyMetadata?: {
    engines?: unknown;
  };
  isActive: boolean;
};

type WeeklyUsageRecord = {
  id: number;
  usedCharacters: number;
};

type UploadDoc = {
  id: number;
  url?: string | null;
};

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>;
type AuthUser = NonNullable<
  Awaited<ReturnType<PayloadInstance["auth"]>>["user"]
>;

const POLLY_ENGINE_PRIORITY: Engine[] = [
  "neural",
  "standard",
  "generative",
  "long-form",
];

function resolvePollyEngine(engines: unknown): Engine {
  if (!Array.isArray(engines)) {
    return "standard";
  }

  const normalized = new Set(
    engines
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase()),
  );

  for (const engine of POLLY_ENGINE_PRIORITY) {
    if (normalized.has(engine)) {
      return engine;
    }
  }

  return "standard";
}

async function resolveVoice(
  payload: PayloadInstance,
  user: AuthUser,
  source: VoiceSource,
  sourceVoiceId?: string,
): Promise<VoiceRecord | null> {
  const targetRelationTo = relationToForSource(source);

  if (!targetRelationTo) return null;

  const modalEngineFilter = isModalEngineSource(source) ? source : null;

  if (sourceVoiceId) {
    const providerWhere =
      targetRelationTo === "modal-voices" && modalEngineFilter
        ? {
            and: [
              { voiceId: { equals: sourceVoiceId } },
              { engines: { contains: modalEngineFilter } },
            ],
          }
        : {
            voiceId: { equals: sourceVoiceId },
          };

    const providerDocs = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: targetRelationTo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: providerWhere as any,
      limit: 1,
      depth: 0,
      user,
    });

    if (providerDocs.docs.length === 0) return null;
    const providerDoc = providerDocs.docs[0];

    const matchedVoice = await payload.find({
      collection: "voices",
      where: {
        and: [
          { "sourceRecord.relationTo": { equals: targetRelationTo } },
          { "sourceRecord.value": { equals: providerDoc.id } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      depth: 1,
      user,
    });

    if (matchedVoice.docs.length > 0) {
      const agnostic = matchedVoice.docs[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceData = agnostic.sourceRecord?.value as any;
      if (sourceData) {
        return {
          id: agnostic.id,
          source,
          sourceVoiceId: sourceData.voiceId,
          name: agnostic.name || sourceData.name,
          languageCode: sourceData.languageCode,
          pollyMetadata: { engines: sourceData.engines },
          isActive: true,
        };
      }
    }
  }

  const defaultWhere = {
    and: [
      { "sourceRecord.relationTo": { equals: targetRelationTo } },
      { isActive: { equals: true } },
      { isDefault: { equals: true } },
    ],
  };

  const preferredDefault = await payload.find({
    collection: "voices",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: defaultWhere as any,
    limit: 50,
    depth: 1,
    user,
  });

  const defaultDoc =
    targetRelationTo === "modal-voices" && modalEngineFilter
      ? preferredDefault.docs.find((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sourceData = doc.sourceRecord?.value as any;
          return modalVoiceSupportsSource(sourceData?.engines, modalEngineFilter);
        })
      : preferredDefault.docs[0];

  if (defaultDoc) {
    const agnostic = defaultDoc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceData = agnostic.sourceRecord?.value as any;
    if (sourceData) {
      return {
        id: agnostic.id,
        source,
        sourceVoiceId: sourceData.voiceId,
        name: agnostic.name || sourceData.name,
        languageCode: sourceData.languageCode,
        pollyMetadata: { engines: sourceData.engines },
        isActive: true,
      };
    }
  }

  return null;
}

async function findWeeklyUsage(
  payload: PayloadInstance,
  weekKey: string,
): Promise<WeeklyUsageRecord | null> {
  const usageResult = await payload.find({
    collection: "tts-weekly-usage",
    where: {
      weekKey: {
        equals: weekKey,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      usedCharacters: true,
    },
  });

  const usageDoc = usageResult.docs[0];
  if (!usageDoc) {
    return null;
  }

  return {
    id: usageDoc.id,
    usedCharacters:
      typeof usageDoc.usedCharacters === "number" ? usageDoc.usedCharacters : 0,
  };
}

async function upsertWeeklyUsage(
  payload: PayloadInstance,
  args: {
    userID: number;
    weekStartISO: string;
    weekKey: string;
    usedCharacters: number;
    usageDocID?: number;
  },
) {
  if (args.usageDocID) {
    await payload.update({
      collection: "tts-weekly-usage",
      id: args.usageDocID,
      overrideAccess: true,
      data: {
        usedCharacters: args.usedCharacters,
      },
    });

    return;
  }

  await payload.create({
    collection: "tts-weekly-usage",
    overrideAccess: true,
    data: {
      user: args.userID,
      weekStart: args.weekStartISO,
      weekKey: args.weekKey,
      usedCharacters: args.usedCharacters,
    },
  });
}

const polly = new PollyClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user || user.collection !== "users") {
      return new Response("Unauthorized. Please log in.", {
        status: 401,
      });
    }

    void runTTSSoftRetentionCleanupIfDue(payload).catch((error) => {
      payload.logger.error(
        `TTS soft retention cleanup failed during request: ${String(error)}`,
      );
    });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        {
          message: "Invalid JSON body",
        },
        { status: 400 },
      );
    }

    const parsedRequest = ttsRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return Response.json(
        {
          message: "Invalid request body",
          errors: parsedRequest.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { text, voiceSource, voiceId, language } = parsedRequest.data;

    const limitSource = await payload.findByID({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      depth: 1,
      select: {
        tier: true,
      },
    });

    const limits = resolveLimitsFromUser({ tier: limitSource.tier });

    if (
      typeof limits.maxCharactersPerRequest === "number" &&
      limits.maxCharactersPerRequest > 0 &&
      text.length > limits.maxCharactersPerRequest
    ) {
      return Response.json(
        {
          message: `Text must be ${limits.maxCharactersPerRequest.toLocaleString()} characters or fewer`,
          limits: {
            maxCharactersPerRequest: limits.maxCharactersPerRequest,
            requestedCharacters: text.length,
          },
        },
        { status: 400 },
      );
    }

    const { weeklyCharacterLimit: characterLimit } = limits;
    const hasWeeklyCharacterLimit = characterLimit > 0;

    const selectedVoice = await resolveVoice(
      payload,
      user,
      voiceSource,
      voiceId,
    );

    if (!selectedVoice) {
      return Response.json(
        {
          message: "Unsupported or inactive voice selection",
        },
        { status: 400 },
      );
    }

    if (
      selectedVoice.source !== "aws-polly" &&
      !isModalEngineSource(selectedVoice.source)
    ) {
      return Response.json(
        {
          message: `Voice source '${selectedVoice.source}' is not yet supported for synthesis`,
        },
        { status: 400 },
      );
    }

    const selectedEngine = resolvePollyEngine(
      selectedVoice.pollyMetadata?.engines,
    );
    const weekStartISO = getCurrentWeekStartUTC().toISOString();
    const weekKey = `${user.id}:${weekStartISO}`;

    const lockResult = await withUserQuotaLock(user.id, async () => {
      const usage = await findWeeklyUsage(payload, weekKey);
      const usedCharacterCount = usage?.usedCharacters ?? 0;

      // Keep quota gating ahead of synthesis so over-limit requests fail fast
      // without triggering third-party generation or storage writes.
      if (
        hasWeeklyCharacterLimit &&
        usedCharacterCount + text.length > characterLimit
      ) {
        return {
          quotaExceeded: true as const,
          usedCharacterCount,
        };
      }

      let audioData: Uint8Array;
      let generationMime = "audio/mpeg";

      if (selectedVoice.source === "aws-polly") {
        const command = new SynthesizeSpeechCommand({
          Text: text,
          OutputFormat: "mp3",
          VoiceId: selectedVoice.sourceVoiceId as VoiceId,
          Engine: selectedEngine,
        });

        const response = await polly.send(command);
        const byteArray = await response.AudioStream?.transformToByteArray();

        if (!byteArray) {
          return {
            quotaExceeded: false as const,
            generation: null,
            noAudio: true as const,
          };
        }
        audioData = new Uint8Array(byteArray);
      } else if (isModalEngineSource(selectedVoice.source)) {
        const modalUrl = process.env.MODAL_TTS_URL;
        if (!modalUrl) {
          throw new Error("MODAL_TTS_URL is not configured");
        }

        const resolvedLanguage =
          language && isValidLanguageForEngine(selectedVoice.source, language)
            ? language
            : getDefaultLanguageForEngine(selectedVoice.source);

        const modalResponse = await fetch(`${modalUrl.replace(/\/$/, "")}/synthesize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            engine: selectedVoice.source,
            text,
            voice_id: selectedVoice.sourceVoiceId,
            language: resolvedLanguage,
          }),
        });

        if (!modalResponse.ok) {
          const errorBody = await modalResponse.text().catch(() => "");
          console.error(
            `Modal synthesis failed (${modalResponse.status}): ${errorBody}`,
          );

          return {
            quotaExceeded: false as const,
            generation: null,
            noAudio: true as const,
            modalError:
              modalResponse.status === 400 ? "voice_not_found" : "modal_unavailable",
          };
        }

        const arrayBuffer = await modalResponse.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          return {
            quotaExceeded: false as const,
            generation: null,
            noAudio: true as const,
            modalError: "modal_unavailable" as const,
          };
        }
        audioData = new Uint8Array(arrayBuffer);
        generationMime = "audio/wav";
      } else {
        return {
          quotaExceeded: false as const,
          generation: null,
          noAudio: true as const,
        };
      }

      const title = text.length > 72 ? `${text.slice(0, 69)}...` : text;
      const extension = generationMime === "audio/wav" ? "wav" : "mp3";
      const audioFileName = `tts-${randomUUID()}.${extension}`;

      let audioUpload: UploadDoc | null = null;

      try {
        const uploadDoc = await payload.create({
          collection: "tts-audio",
          overrideAccess: true,
          data: {
            user: user.id,
          },
          user,
          file: {
            data: Buffer.from(audioData),
            mimetype: generationMime,
            name: audioFileName,
            size: audioData.byteLength,
          },
        });

        audioUpload = uploadDoc as UploadDoc;

        const generation = await payload.create({
          collection: "tts-generations",
          overrideAccess: true,
          data: {
            title,
            inputText: text,
            voice: selectedVoice.id,
            voiceSource: selectedVoice.source,
            sourceVoiceId: selectedVoice.sourceVoiceId,
            voiceName: selectedVoice.name,
            voiceLocale:
              isModalEngineSource(selectedVoice.source)
                ? (language &&
                  isValidLanguageForEngine(selectedVoice.source, language)
                    ? language
                    : getDefaultLanguageForEngine(selectedVoice.source))
                : selectedVoice.languageCode || null,
            voiceEngine:
              selectedVoice.source === "aws-polly" ? selectedEngine : null,
            audio: uploadDoc.id,
            audioMime: generationMime,
            audioByteLength: audioData.byteLength,
            charCount: text.length,
            user: user.id,
          },
          user,
        });

        const nextUsedCharacters = usedCharacterCount + text.length;

        try {
          await upsertWeeklyUsage(payload, {
            userID: user.id,
            weekStartISO,
            weekKey,
            usedCharacters: nextUsedCharacters,
            usageDocID: usage?.id,
          });
        } catch (usageError) {
          await payload
            .delete({
              collection: "tts-generations",
              id: generation.id,
              overrideAccess: true,
              user,
            })
            .catch(() => undefined);
          throw usageError;
        }

        return {
          quotaExceeded: false as const,
          generation,
          audioUrl:
            typeof uploadDoc.url === "string" && uploadDoc.url.length > 0
              ? uploadDoc.url
              : null,
          usedCharacterCount: nextUsedCharacters,
          noAudio: false as const,
        };
      } catch (error) {
        if (audioUpload?.id) {
          await payload
            .delete({
              collection: "tts-audio",
              id: audioUpload.id,
              overrideAccess: true,
              user,
            })
            .catch(() => undefined);
        }

        throw error;
      }
    });

    if (lockResult.quotaExceeded) {
      return Response.json(
        {
          message:
            "Weekly character limit reached. Contact an admin to increase your quota.",
          limits: {
            characterLimit,
            usedCharacters: lockResult.usedCharacterCount,
            requestedCharacters: text.length,
            weekStart: weekStartISO,
          },
        },
        { status: 429 },
      );
    }

    if (lockResult.noAudio || !lockResult.generation) {
      const message =
        "modalError" in lockResult && lockResult.modalError === "voice_not_found"
          ? "Voice not found on the Modal engine. Check the voice registry."
          : "modalError" in lockResult && lockResult.modalError === "modal_unavailable"
            ? "Modal TTS is unavailable. Try again in a moment."
            : "No audio generated";

      return Response.json(
        {
          message,
        },
        { status: 502 },
      );
    }

    const generation = lockResult.generation;

    return Response.json(
      {
        generation: {
          id: generation.id,
          title: generation.title,
          inputText: generation.inputText,
          voiceSource: generation.voiceSource,
          sourceVoiceId: generation.sourceVoiceId,
          voiceName: generation.voiceName,
          voiceLocale: generation.voiceLocale,
          voiceEngine: generation.voiceEngine,
          audioMime: generation.audioMime,
          audioUrl: lockResult.audioUrl,
          audioByteLength: generation.audioByteLength,
          charCount: generation.charCount,
          createdAt: generation.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("TTS Route Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
