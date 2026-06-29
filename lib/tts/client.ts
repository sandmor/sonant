import { getSourceLabel } from "@/lib/voices";

export type AuthUser = {
  id: number;
  email: string;
  name?: string;
};

export type UsageData = {
  usedCharacters: number;
  characterLimit: number;
  maxCharactersPerRequest: number;
  weekStart: string;
  percentage: number;
  remaining: number;
};

export type GenerationKind = "script" | "subtitles";

export type Generation = {
  id: number;
  title: string;
  inputText: string;
  voiceSource: string;
  sourceVoiceId: string;
  voiceName: string;
  voiceLocale?: string;
  voiceEngine?: string;
  audioMime: string | null;
  audioUrl: string | null;
  audioByteLength: number | null;
  charCount: number;
  createdAt: string;
  kind?: GenerationKind;
  srtFilename?: string;
  cuesTotal?: number;
  timelineDurationMs?: number;
};

export type SrtFitSettings = {
  maxSpeedup: number;
  mode: "compress_and_pad";
};

export type { SrtCue } from "@/lib/tts/srt";

export type SrtCueWarning = {
  cueIndex: number;
  code: "overrun_after_clamp" | "heavy_compression_likely";
  message: string;
};

export type SrtJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SrtJob = {
  id: number;
  status: SrtJobStatus;
  engine: string;
  sourceVoiceId: string;
  voiceName: string;
  language: string;
  srtFilename: string;
  cuesTotal: number;
  cuesDone: number;
  phase?: "synthesizing" | "postprocessing";
  fitSettings: SrtFitSettings;
  warnings: SrtCueWarning[];
  error?: string;
  generationId?: number;
  generation?: Generation;
  createdAt: string;
  updatedAt: string;
};

export type GenerationWithAudio = Generation & {
  audioUrl: string;
};

export type VoiceOption = {
  id: number;
  source: string;
  sourceVoiceId: string;
  name: string;
  supportedEngines?: string[];
  languageCode?: string;
  languageName?: string;
  defaultLanguage?: string | null;
  gender: string;
  engines?: string[];
  isDefault: boolean;
};

export type AuthFormState = {
  email: string;
  password: string;
};

export const initialLoginForm: AuthFormState = {
  email: "",
  password: "",
};

export const initialRegisterForm: AuthFormState = {
  email: "",
  password: "",
};

export function normalizeGeneration(value: unknown): Generation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (
    typeof raw.id !== "number" ||
    typeof raw.title !== "string" ||
    typeof raw.inputText !== "string" ||
    typeof raw.voiceSource !== "string" ||
    typeof raw.sourceVoiceId !== "string" ||
    typeof raw.voiceName !== "string" ||
    typeof raw.charCount !== "number" ||
    typeof raw.createdAt !== "string"
  ) {
    return null;
  }
  const audioUrl =
    typeof raw.audioUrl === "string" && raw.audioUrl.length > 0
      ? raw.audioUrl
      : null;
  const audioMime =
    typeof raw.audioMime === "string" && raw.audioMime.length > 0
      ? raw.audioMime
      : null;
  const audioByteLength =
    typeof raw.audioByteLength === "number" ? raw.audioByteLength : null;

  return {
    id: raw.id,
    title: raw.title,
    inputText: raw.inputText,
    voiceSource: raw.voiceSource,
    sourceVoiceId: raw.sourceVoiceId,
    voiceName: raw.voiceName,
    voiceLocale:
      typeof raw.voiceLocale === "string" ? raw.voiceLocale : undefined,
    voiceEngine:
      typeof raw.voiceEngine === "string" ? raw.voiceEngine : undefined,
    audioUrl,
    audioMime,
    audioByteLength,
    charCount: raw.charCount,
    createdAt: raw.createdAt,
    kind: raw.kind === "subtitles" || raw.kind === "script" ? raw.kind : undefined,
    srtFilename:
      typeof raw.srtFilename === "string" ? raw.srtFilename : undefined,
    cuesTotal: typeof raw.cuesTotal === "number" ? raw.cuesTotal : undefined,
    timelineDurationMs:
      typeof raw.timelineDurationMs === "number"
        ? raw.timelineDurationMs
        : undefined,
  };
}

export function normalizeSrtJob(value: unknown): SrtJob | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (
    typeof raw.id !== "number" ||
    typeof raw.status !== "string" ||
    typeof raw.engine !== "string" ||
    typeof raw.sourceVoiceId !== "string" ||
    typeof raw.voiceName !== "string" ||
    typeof raw.language !== "string" ||
    typeof raw.srtFilename !== "string" ||
    typeof raw.cuesTotal !== "number" ||
    typeof raw.cuesDone !== "number" ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string"
  ) {
    return null;
  }

  const fitSettingsRaw = raw.fitSettings;
  const fitSettings =
    fitSettingsRaw &&
    typeof fitSettingsRaw === "object" &&
    typeof (fitSettingsRaw as { maxSpeedup?: unknown }).maxSpeedup === "number"
      ? {
          maxSpeedup: (fitSettingsRaw as { maxSpeedup: number }).maxSpeedup,
          mode: "compress_and_pad" as const,
        }
      : { maxSpeedup: 2, mode: "compress_and_pad" as const };

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter(
        (entry): entry is SrtCueWarning =>
          Boolean(entry) &&
          typeof entry === "object" &&
          typeof (entry as SrtCueWarning).cueIndex === "number" &&
          typeof (entry as SrtCueWarning).code === "string" &&
          typeof (entry as SrtCueWarning).message === "string",
      )
    : [];

  const generation = normalizeGeneration(raw.generation);

  return {
    id: raw.id,
    status: raw.status as SrtJobStatus,
    engine: raw.engine,
    sourceVoiceId: raw.sourceVoiceId,
    voiceName: raw.voiceName,
    language: raw.language,
    srtFilename: raw.srtFilename,
    cuesTotal: raw.cuesTotal,
    cuesDone: raw.cuesDone,
    phase:
      raw.phase === "synthesizing" || raw.phase === "postprocessing"
        ? raw.phase
        : undefined,
    fitSettings,
    warnings,
    error: typeof raw.error === "string" ? raw.error : undefined,
    generationId:
      typeof raw.generationId === "number" ? raw.generationId : undefined,
    generation: generation ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function hasPlayableAudio(
  generation: Generation,
): generation is GenerationWithAudio {
  return Boolean(generation.audioUrl);
}

export function normalizeVoice(value: unknown): VoiceOption | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (
    typeof raw.id !== "number" ||
    typeof raw.source !== "string" ||
    typeof raw.sourceVoiceId !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.gender !== "string" ||
    typeof raw.isDefault !== "boolean"
  ) {
    return null;
  }

  const engines =
    Array.isArray(raw.engines) &&
    raw.engines.every((entry) => typeof entry === "string")
      ? raw.engines
      : undefined;

  const supportedEngines = Array.isArray(raw.supportedEngines)
    ? raw.supportedEngines.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : undefined;

  return {
    id: raw.id,
    source: raw.source,
    sourceVoiceId: raw.sourceVoiceId,
    name: raw.name,
    supportedEngines,
    languageCode:
      typeof raw.languageCode === "string" ? raw.languageCode : undefined,
    languageName:
      typeof raw.languageName === "string" ? raw.languageName : undefined,
    defaultLanguage:
      typeof raw.defaultLanguage === "string" ? raw.defaultLanguage : null,
    gender: raw.gender,
    engines: engines,
    isDefault: raw.isDefault,
  };
}

function getErrorMessage(payload: unknown, fallbackMessage: string) {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  const data = payload as Record<string, unknown>;

  if (typeof data.message === "string") {
    return data.message;
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const firstError = data.errors[0];
    if (typeof firstError === "string") {
      return firstError;
    }
    if (
      typeof firstError === "object" &&
      firstError !== null &&
      "message" in firstError &&
      typeof firstError.message === "string"
    ) {
      return firstError.message;
    }
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  return fallbackMessage;
}

export async function readErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return getErrorMessage(payload, fallbackMessage);
  }

  const payload = await response.text().catch(() => "");
  return payload || fallbackMessage;
}

export function formatTimestamp(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(value);
}

export function voiceLabelFromGeneration(generation: Generation) {
  const engineLabel = getSourceLabel(generation.voiceSource);

  if (generation.voiceLocale) {
    return `${generation.voiceName} · ${engineLabel} · ${generation.voiceLocale}`;
  }

  if (generation.voiceEngine) {
    return `${generation.voiceName} · ${generation.voiceEngine}`;
  }

  if (generation.voiceSource !== "aws-polly") {
    return `${generation.voiceName} · ${engineLabel}`;
  }

  return generation.voiceName;
}
