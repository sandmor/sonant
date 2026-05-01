"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max?: number | null;
  warningThreshold?: number;
  criticalThreshold?: number;
  className?: string;
}

export function CharacterCounter({
  current,
  max,
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
  className,
}: CharacterCounterProps) {
  const hasMax = typeof max === "number" && Number.isFinite(max) && max > 0;
  const percentage = hasMax ? Math.min(current / max, 1) : 0;
  const isWarning = hasMax && percentage >= warningThreshold;
  const isCritical = hasMax && percentage >= criticalThreshold;
  const isAtLimit = hasMax && current >= max;

  // Determine color based on state
  const getColorClass = () => {
    if (isAtLimit) return "bg-destructive";
    if (isCritical) return "bg-amber-500";
    if (isWarning) return "bg-amber-400";
    return "bg-primary";
  };

  const getTextColorClass = () => {
    if (isAtLimit) return "text-destructive";
    if (isCritical) return "text-amber-600 dark:text-amber-400";
    if (isWarning) return "text-amber-500";
    return "text-muted-foreground";
  };

  return (
    <div
      className={cn("flex items-center gap-2 text-xs", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {hasMax ? (
        <>
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-out",
                getColorClass(),
              )}
              style={{ width: `${percentage * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <span
            className={cn(
              "tabular-nums font-medium whitespace-nowrap transition-colors duration-200",
              getTextColorClass(),
            )}
          >
            {current.toLocaleString()}
            <span className="text-muted-foreground/60">
              /{max.toLocaleString()}
            </span>
          </span>
        </>
      ) : (
        <span
          className={cn(
            "tabular-nums font-medium whitespace-nowrap transition-colors duration-200 text-muted-foreground",
          )}
        >
          {current.toLocaleString()}
          <span className="text-muted-foreground/60"> chars</span>
        </span>
      )}
    </div>
  );
}
