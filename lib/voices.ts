export const VOICE_SOURCE_VALUES = [
  "aws-polly",
  "qwen",
  "chatterbox",
] as const;
export type VoiceSource = (typeof VOICE_SOURCE_VALUES)[number];

export const MODAL_ENGINE_SOURCES = ["qwen", "chatterbox"] as const;
export type ModalEngineSource = (typeof MODAL_ENGINE_SOURCES)[number];

export const DEFAULT_VOICE_SOURCE: VoiceSource = "aws-polly";

const VOICE_KEY_SEPARATOR = "::";

export function isModalEngineSource(
  source: string,
): source is ModalEngineSource {
  return MODAL_ENGINE_SOURCES.includes(source as ModalEngineSource);
}

export function modalVoiceSupportsSource(
  engines: string[] | null | undefined,
  source: ModalEngineSource,
): boolean {
  return Array.isArray(engines) && engines.includes(source);
}

export function relationToForSource(source: VoiceSource): string | null {
  if (source === "aws-polly") {
    return "polly-voices";
  }

  if (isModalEngineSource(source)) {
    return "modal-voices";
  }

  return null;
}

export function makeVoiceKey(source: string, voiceId: string) {
  return `${source}${VOICE_KEY_SEPARATOR}${voiceId}`;
}

export function parseVoiceKey(voiceKey: string) {
  const separatorIndex = voiceKey.indexOf(VOICE_KEY_SEPARATOR);

  if (separatorIndex <= 0) {
    return null;
  }

  const source = voiceKey.slice(0, separatorIndex).trim();
  const voiceId = voiceKey
    .slice(separatorIndex + VOICE_KEY_SEPARATOR.length)
    .trim();

  if (!source || !voiceId) {
    return null;
  }

  if (!VOICE_SOURCE_VALUES.includes(source as VoiceSource)) {
    return null;
  }

  return {
    source: source as VoiceSource,
    voiceId,
  };
}

export function getSourceLabel(source: string) {
  switch (source) {
    case "aws-polly":
      return "AWS Polly";
    case "qwen":
      return "Qwen";
    case "chatterbox":
      return "Chatterbox";
    default:
      return source;
  }
}

export function getEngineLabel(source: string) {
  return getSourceLabel(source);
}
