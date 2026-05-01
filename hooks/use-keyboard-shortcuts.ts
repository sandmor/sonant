"use client";

import * as React from "react";

interface Shortcut {
  key: string;
  modifier?: "ctrl" | "meta" | "alt" | "shift";
  action: () => void;
  preventDefault?: boolean;
  condition?: () => boolean;
  allowInInput?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isTypingTarget =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable);

      for (const shortcut of shortcuts) {
        if (!shortcut || typeof shortcut.key !== "string") {
          continue;
        }

        if (typeof event.key !== "string") {
          continue;
        }

        // Avoid single-key shortcuts while typing unless allowed or has modifier
        if (isTypingTarget && !shortcut.allowInInput && !shortcut.modifier) {
          continue;
        }

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        let modifierMatch = true;
        if (shortcut.modifier) {
          switch (shortcut.modifier) {
            case "ctrl":
              modifierMatch = event.ctrlKey;
              break;
            case "meta":
              modifierMatch = event.metaKey;
              break;
            case "alt":
              modifierMatch = event.altKey;
              break;
            case "shift":
              modifierMatch = event.shiftKey;
              break;
          }
        }

        if (keyMatch && modifierMatch) {
          if (shortcut.condition && !shortcut.condition()) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          shortcut.action();
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
