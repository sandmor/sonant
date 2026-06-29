import { getPayload } from "payload";
import configPromise from "@payload-config";
import { z } from "zod";

import {
  getDefaultLanguageForEngine,
  isValidLanguageForEngine,
} from "@/lib/tts/languages";
import { synthesizeModalCue } from "@/lib/server/modal-srt";
import { resolveVoice } from "@/lib/server/tts-voice";
import { MODAL_ENGINE_SOURCES, type ModalEngineSource } from "@/lib/voices";

export const runtime = "nodejs";

const cueSchema = z.object({
  index: z.number().int().positive(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().trim().min(1),
});

const previewSchema = z.object({
  engine: z.enum(MODAL_ENGINE_SOURCES),
  voiceId: z.string().trim().min(1),
  language: z.string().trim().optional(),
  cue: cueSchema,
  fit: z
    .object({
      maxSpeedup: z.coerce.number().min(1).max(4).default(2),
      mode: z.literal("compress_and_pad").default("compress_and_pad"),
    })
    .optional(),
});

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

    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          message: "Invalid request body",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { engine, voiceId, language, cue, fit } = parsed.data;

    if (cue.endMs <= cue.startMs) {
      return Response.json(
        { message: "Cue end time must be after start time" },
        { status: 400 },
      );
    }

    const selectedVoice = await resolveVoice(
      payload,
      user,
      engine as ModalEngineSource,
      voiceId,
    );

    if (!selectedVoice) {
      return Response.json(
        { message: "Unsupported or inactive voice selection" },
        { status: 400 },
      );
    }

    const resolvedLanguage =
      language && isValidLanguageForEngine(engine, language)
        ? language
        : getDefaultLanguageForEngine(engine);

    const fitSettings = {
      maxSpeedup: fit?.maxSpeedup ?? 2,
      mode: "compress_and_pad" as const,
    };

    const audioData = await synthesizeModalCue({
      engine: selectedVoice.source as "qwen" | "chatterbox",
      voiceId: selectedVoice.sourceVoiceId,
      language: resolvedLanguage,
      cue,
      fit: fitSettings,
    });

    return new Response(audioData, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("SRT Preview POST Error:", error);
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to preview cue",
      },
      { status: 502 },
    );
  }
}
