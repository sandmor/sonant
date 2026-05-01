"use client";

import { Gauge } from "lucide-react";

import type { UsageData } from "@/lib/tts/client";
import { cn } from "@/lib/utils";

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return "bg-destructive";
  if (percentage >= 70) return "bg-amber-glow";
  return "bg-primary";
}

function getUsageGlowClass(percentage: number): string {
  if (percentage >= 90) return "shadow-[0_0_8px_rgba(239,68,68,0.4)]";
  if (percentage >= 70) return "shadow-[0_0_8px_rgba(245,158,11,0.35)]";
  return "";
}

export function UsageIndicator({
  usage,
  isLoading,
}: {
  usage: UsageData | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <div className="h-4 w-20 animate-pulse rounded-md bg-muted/50" />
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const { usedCharacters, characterLimit, percentage } = usage;
  const isUnlimited = characterLimit === 0;
  const isWarning = percentage >= 70;
  const isCritical = percentage >= 90;

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <Gauge className="size-3.5 text-muted-foreground/70" />

      <div className="flex flex-col gap-1">
        {!isUnlimited ? (
          <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted/50">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                getUsageColor(percentage),
                isWarning && getUsageGlowClass(percentage),
              )}
              style={{
                width: `${Math.min(100, percentage)}%`,
              }}
            />
          </div>
        ) : (
          <div className="h-1.5 w-24 rounded-full bg-muted/30" />
        )}

        <div className="flex items-center gap-1 text-[11px] leading-none">
          <span
            className={cn(
              "tabular-nums font-medium",
              isCritical
                ? "text-destructive"
                : isWarning
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
            )}
          >
            {usedCharacters.toLocaleString()}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="tabular-nums text-muted-foreground">
            {isUnlimited ? "Unlimited" : characterLimit.toLocaleString()}
          </span>
          <span className="text-muted-foreground/60">chars</span>
        </div>
      </div>

      {/* Pulse indicator for critical/warning states */}
      {!isUnlimited && (isWarning || isCritical) && (
        <span
          className={cn(
            "size-1.5 rounded-full animate-pulse-glow",
            isCritical ? "bg-destructive" : "bg-amber-500",
          )}
        />
      )}
    </div>
  );
}
