"use client";

import * as React from "react";

import {
  DEFAULT_VOICE_SOURCE,
  isModalEngineSource,
  MODAL_ENGINE_SOURCES,
  type ModalEngineSource,
  type VoiceSource,
} from "@/lib/voices";
import type { SrtCue, SrtFitSettings } from "@/lib/tts/client";

export type StudioMode = "script" | "subtitles";

export type StudioDraft = {
  mode: StudioMode;
  text: string;
  engine: VoiceSource;
  voiceId: string;
  language: string;
  srtFilename: string;
  srtText: string;
  srtCues: SrtCue[];
  fitSettings: SrtFitSettings;
  timestamp: number;
};

const STORAGE_KEY = "sonant-draft";
const MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_SRT_CUES_STORED = 200;

export function useDraftPersistence(
  draft: StudioDraft,
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>,
) {
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const data = JSON.parse(saved) as Partial<StudioDraft>;
      if (Date.now() - (data.timestamp ?? 0) >= MAX_AGE) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const hasScriptDraft =
        typeof data.text === "string" && data.text.trim().length > 0;
      const hasSubtitleDraft =
        typeof data.srtText === "string" && data.srtText.trim().length > 0;

      if (!hasScriptDraft && !hasSubtitleDraft) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setDraft((current) => ({
        ...current,
        mode: data.mode === "subtitles" ? "subtitles" : "script",
        text: typeof data.text === "string" ? data.text : current.text,
        engine:
          typeof data.engine === "string"
            ? (data.engine as VoiceSource)
            : current.engine,
        voiceId:
          typeof data.voiceId === "string" ? data.voiceId : current.voiceId,
        language:
          typeof data.language === "string"
            ? data.language
            : current.language,
        srtFilename:
          typeof data.srtFilename === "string"
            ? data.srtFilename
            : current.srtFilename,
        srtText:
          typeof data.srtText === "string" ? data.srtText : current.srtText,
        srtCues: Array.isArray(data.srtCues)
          ? data.srtCues.slice(0, MAX_SRT_CUES_STORED)
          : current.srtCues,
        fitSettings:
          data.fitSettings &&
          typeof data.fitSettings === "object" &&
          typeof (data.fitSettings as SrtFitSettings).maxSpeedup === "number"
            ? {
                maxSpeedup: (data.fitSettings as SrtFitSettings).maxSpeedup,
                mode: "compress_and_pad",
              }
            : current.fitSettings,
      }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [setDraft]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const hasContent =
        draft.text.trim().length > 0 || draft.srtText.trim().length > 0;

      if (hasContent) {
        const data: StudioDraft = {
          ...draft,
          srtCues: draft.srtCues.slice(0, MAX_SRT_CUES_STORED),
          timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [draft]);

  const clearDraft = React.useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { clearDraft };
}

export function createInitialDraft(): StudioDraft {
  return {
    mode: "script",
    text: "",
    engine: DEFAULT_VOICE_SOURCE,
    voiceId: "",
    language: "English",
    srtFilename: "",
    srtText: "",
    srtCues: [],
    fitSettings: {
      maxSpeedup: 2,
      mode: "compress_and_pad",
    },
    timestamp: Date.now(),
  };
}

export function isModalDraftEngine(engine: VoiceSource) {
  return isModalEngineSource(engine);
}

export function defaultSubtitleEngine(
  engine: VoiceSource,
): ModalEngineSource {
  if (isModalEngineSource(engine)) {
    return engine;
  }

  return MODAL_ENGINE_SOURCES[0];
}
