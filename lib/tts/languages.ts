import type { ModalEngineSource } from "@/lib/voices";

export type LanguageOption = {
  id: string;
  label: string;
};

export const QWEN_LANGUAGES: LanguageOption[] = [
  { id: "English", label: "English" },
  { id: "Chinese", label: "Chinese" },
  { id: "French", label: "French" },
  { id: "Spanish", label: "Spanish" },
  { id: "Korean", label: "Korean" },
  { id: "Japanese", label: "Japanese" },
  { id: "German", label: "German" },
  { id: "Italian", label: "Italian" },
  { id: "Russian", label: "Russian" },
  { id: "Portuguese", label: "Portuguese" },
  { id: "Dutch", label: "Dutch" },
  { id: "Turkish", label: "Turkish" },
  { id: "Arabic", label: "Arabic" },
  { id: "Polish", label: "Polish" },
  { id: "Indonesian", label: "Indonesian" },
  { id: "Vietnamese", label: "Vietnamese" },
];

export const CHATTERBOX_LANGUAGES: LanguageOption[] = [
  { id: "ar", label: "Arabic" },
  { id: "zh", label: "Chinese" },
  { id: "nl", label: "Dutch" },
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "hi", label: "Hindi" },
  { id: "it", label: "Italian" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "pl", label: "Polish" },
  { id: "pt", label: "Portuguese" },
  { id: "ru", label: "Russian" },
  { id: "es", label: "Spanish" },
  { id: "sv", label: "Swedish" },
  { id: "tr", label: "Turkish" },
];

const LANGUAGES_BY_ENGINE: Record<ModalEngineSource, LanguageOption[]> = {
  qwen: QWEN_LANGUAGES,
  chatterbox: CHATTERBOX_LANGUAGES,
};

const DEFAULT_LANGUAGE_BY_ENGINE: Record<ModalEngineSource, string> = {
  qwen: "English",
  chatterbox: "en",
};

export function isModalEngine(engine: string): engine is ModalEngineSource {
  return engine === "qwen" || engine === "chatterbox";
}

export function getLanguagesForEngine(engine: ModalEngineSource) {
  return LANGUAGES_BY_ENGINE[engine];
}

export function getDefaultLanguageForEngine(engine: ModalEngineSource) {
  return DEFAULT_LANGUAGE_BY_ENGINE[engine];
}

export function isValidLanguageForEngine(
  engine: ModalEngineSource,
  language: string,
) {
  return getLanguagesForEngine(engine).some((entry) => entry.id === language);
}
