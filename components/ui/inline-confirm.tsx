"use client";

import * as React from "react";
import { Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineConfirmProps {
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  className?: string;
  "aria-label"?: string;
}

export function InlineConfirm({
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  className,
  "aria-label": ariaLabel = "Delete item",
}: InlineConfirmProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to cancel
  React.useEffect(() => {
    if (!isConfirming) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsConfirming(false);
        onCancel?.();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsConfirming(false);
        onCancel?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isConfirming, onCancel]);

  const handleInitialClick = () => {
    setIsConfirming(true);
  };

  const handleConfirm = () => {
    setIsConfirming(false);
    onConfirm();
  };

  const handleCancel = () => {
    setIsConfirming(false);
    onCancel?.();
  };

  if (isConfirming) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "inline-flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150",
          className,
        )}
        role="alertdialog"
        aria-modal="true"
        aria-live="polite"
      >
        <button
          type="button"
          onClick={handleConfirm}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            variant === "destructive"
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-primary/10 text-primary hover:bg-primary/20",
          )}
          aria-label={confirmLabel}
        >
          <Check className="size-3" />
          <span className="sr-only sm:not-sr-only">{confirmLabel}</span>
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={cancelLabel}
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInitialClick}
      className={cn(
        "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={ariaLabel}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
