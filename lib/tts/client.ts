export type AuthUser = {
  id: number;
  email: string;
  name?: string;
};

export type Generation = {
  id: number;
  title: string;
  inputText: string;
  voiceSource: string;
  sourceVoiceId: string;
  voiceName: string;
  voiceLocale: string;
  voiceEngine: string;
  audioMime: string | null;
  audioUrl: string | null;
  audioByteLength: number | null;
  charCount: number;
  createdAt: string;
};

export type GenerationWithAudio = Generation & {
  audioUrl: string;
};

export type VoiceOption = {
  id: number;
  source: string;
  sourceVoiceId: string;
  name: string;
  languageCode: string;
  languageName: string;
  gender: string;
  engines: string[];
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
    typeof raw.voiceLocale !== "string" ||
    typeof raw.voiceEngine !== "string" ||
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
    voiceLocale: raw.voiceLocale,
    voiceEngine: raw.voiceEngine,
    audioUrl,
    audioMime,
    audioByteLength,
    charCount: raw.charCount,
    createdAt: raw.createdAt,
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
    typeof raw.languageCode !== "string" ||
    typeof raw.languageName !== "string" ||
    typeof raw.gender !== "string" ||
    !Array.isArray(raw.engines) ||
    raw.engines.some((entry) => typeof entry !== "string") ||
    typeof raw.isDefault !== "boolean"
  ) {
    return null;
  }

  return {
    id: raw.id,
    source: raw.source,
    sourceVoiceId: raw.sourceVoiceId,
    name: raw.name,
    languageCode: raw.languageCode,
    languageName: raw.languageName,
    gender: raw.gender,
    engines: raw.engines,
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

  if (Array.isArray(data.errors) && typeof data.errors[0] === "string") {
    return data.errors[0];
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
  return `${generation.voiceName} · ${generation.voiceLocale}`;
}
