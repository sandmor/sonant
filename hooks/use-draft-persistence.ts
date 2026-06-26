"use client";

import * as React from "react";

import {
  DEFAULT_VOICE_SOURCE,
  isModalEngineSource,
  type VoiceSource,
} from "@/lib/voices";

export type StudioDraft = {
  text: string;
  engine: VoiceSource;
  voiceId: string;
  language: string;
  timestamp: number;
};

const STORAGE_KEY = "sonant-draft";
const MAX_AGE = 24 * 60 * 60 * 1000;

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
      if (
        Date.now() - (data.timestamp ?? 0) < MAX_AGE &&
        typeof data.text === "string" &&
        data.text.trim()
      ) {
        setDraft((current) => ({
          ...current,
          text: data.text ?? current.text,
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
        }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [setDraft]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (draft.text.trim()) {
        const data: StudioDraft = {
          ...draft,
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
    text: "",
    engine: DEFAULT_VOICE_SOURCE,
    voiceId: "",
    language: "English",
    timestamp: Date.now(),
  };
}

export function isModalDraftEngine(engine: VoiceSource) {
  return isModalEngineSource(engine);
}
