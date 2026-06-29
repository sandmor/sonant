import type { SrtCue } from "@/lib/tts/srt";
import type { SrtFitSettings } from "@/lib/tts/client";

function getModalBaseUrl() {
  const modalUrl = process.env.MODAL_TTS_URL;
  if (!modalUrl) {
    throw new Error("MODAL_TTS_URL is not configured");
  }

  return modalUrl.replace(/\/$/, "");
}

export function cuesToModalPayload(cues: SrtCue[]) {
  return cues.map((cue) => ({
    index: cue.index,
    start_ms: cue.startMs,
    end_ms: cue.endMs,
    text: cue.text,
  }));
}

export function fitToModalPayload(fit: SrtFitSettings) {
  return {
    max_speedup: fit.maxSpeedup,
    mode: fit.mode,
  };
}

export async function spawnModalSrtJob(args: {
  engine: string;
  voiceId: string;
  language: string;
  cues: SrtCue[];
  fit: SrtFitSettings;
  jobId: string;
  outputFilename: string;
}) {
  const response = await fetch(`${getModalBaseUrl()}/synthesize-srt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      engine: args.engine,
      voice_id: args.voiceId,
      language: args.language,
      cues: cuesToModalPayload(args.cues),
      fit: fitToModalPayload(args.fit),
      job_id: args.jobId,
      output_filename: args.outputFilename,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Modal SRT spawn failed (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as {
    call_id: string;
    cues_total: number;
  };
}

export type ModalSrtStatus =
  | {
      status: "running";
      cuesDone: number;
      cuesTotal: number;
      phase?: "synthesizing" | "postprocessing";
    }
  | {
      status: "completed";
      cuesDone: number;
      cuesTotal: number;
      warnings: Array<{
        cueIndex?: number;
        code?: string;
        message?: string;
      }>;
      totalDurationMs: number;
      filename: string;
      byteLength: number;
      mimeType: string;
    }
  | {
      status: "failed";
      cuesDone: number;
      cuesTotal: number;
      error?: string;
    };

export async function fetchModalSrtStatus(
  callId: string,
  jobId: string,
): Promise<ModalSrtStatus> {
  const params = new URLSearchParams({
    call_id: callId,
    job_id: jobId,
  });

  const response = await fetch(`${getModalBaseUrl()}/srt-status?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Modal SRT status failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  if (payload.status === "completed") {
    const warnings = Array.isArray(payload.warnings)
      ? (payload.warnings as Array<{
          cueIndex?: number;
          code?: string;
          message?: string;
        }>)
      : [];

    return {
      status: "completed",
      cuesDone: Number(payload.cuesDone ?? 0),
      cuesTotal: Number(payload.cuesTotal ?? 0),
      warnings,
      totalDurationMs: Number(payload.total_duration_ms ?? 0),
      filename: String(payload.filename ?? ""),
      byteLength: Number(payload.byte_length ?? 0),
      mimeType:
        typeof payload.mime_type === "string" ? payload.mime_type : "audio/wav",
    };
  }

  if (payload.status === "failed") {
    return {
      status: "failed",
      cuesDone: Number(payload.cuesDone ?? 0),
      cuesTotal: Number(payload.cuesTotal ?? 0),
      error: typeof payload.error === "string" ? payload.error : "SRT job failed",
    };
  }

  return {
    status: "running",
    cuesDone: Number(payload.cuesDone ?? 0),
    cuesTotal: Number(payload.cuesTotal ?? 0),
    phase:
      payload.phase === "synthesizing" || payload.phase === "postprocessing"
        ? payload.phase
        : undefined,
  };
}

export async function synthesizeModalCue(args: {
  engine: string;
  voiceId: string;
  language: string;
  cue: SrtCue;
  fit: SrtFitSettings;
}) {
  const response = await fetch(`${getModalBaseUrl()}/synthesize-cue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      engine: args.engine,
      voice_id: args.voiceId,
      language: args.language,
      cue: {
        index: args.cue.index,
        start_ms: args.cue.startMs,
        end_ms: args.cue.endMs,
        text: args.cue.text,
      },
      fit: fitToModalPayload(args.fit),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Modal cue preview failed (${response.status}): ${errorBody}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
