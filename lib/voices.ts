export const VOICE_SOURCE_VALUES = ["aws-polly", "other"] as const;
export type VoiceSource = (typeof VOICE_SOURCE_VALUES)[number];

export const DEFAULT_VOICE_SOURCE: VoiceSource = "aws-polly";

const VOICE_KEY_SEPARATOR = "::";

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
    default:
      return source;
  }
}
