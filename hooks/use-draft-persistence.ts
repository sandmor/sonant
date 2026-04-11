"use client";

import * as React from "react";

interface DraftData {
  text: string;
  timestamp: number;
}

const STORAGE_KEY = "sonant-draft";
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function useDraftPersistence(
  currentText: string,
  setText: (text: string) => void,
) {
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: DraftData = JSON.parse(saved);
        if (Date.now() - data.timestamp < MAX_AGE && data.text.trim()) {
          setText(data.text);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [setText]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentText.trim()) {
        const data: DraftData = {
          text: currentText,
          timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [currentText]);

  const clearDraft = React.useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { clearDraft };
}
