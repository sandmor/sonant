"use client";

import {
  cueSlotMs,
  formatCueTimeRange,
  formatDuration,
  mayNeedHeavyCompression,
  type SrtCue,
} from "@/lib/tts/srt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoaderCircle, Play, Search } from "lucide-react";

type CueTableProps = {
  cues: SrtCue[];
  query: string;
  onQueryChange: (value: string) => void;
  previewingCueIndex: number | null;
  onPreviewCue: (cue: SrtCue) => void;
  onStopPreview: () => void;
};

function filteredCues(cues: SrtCue[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return cues;
  }

  return cues.filter(
    (cue) =>
      cue.text.toLowerCase().includes(normalized) ||
      String(cue.index).includes(normalized),
  );
}

export function CueTable({
  cues,
  query,
  onQueryChange,
  previewingCueIndex,
  onPreviewCue,
  onStopPreview,
}: CueTableProps) {
  const visibleCues = filteredCues(cues, query);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search cues…"
          className="rounded-xl border-border/40 bg-card/60 pl-9 text-sm backdrop-blur-sm"
        />
      </div>

      {visibleCues.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No cues match your search.
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border/40 sm:block">
            <div className="grid grid-cols-[3rem_1fr_5rem_1.5fr_auto] gap-3 border-b border-border/30 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>#</span>
              <span>Time</span>
              <span>Slot</span>
              <span>Text</span>
              <span className="text-right">Preview</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {visibleCues.map((cue) => {
                const isPreviewing = previewingCueIndex === cue.index;
                const heavy = mayNeedHeavyCompression(cue);

                return (
                  <div
                    key={cue.index}
                    className="grid grid-cols-[3rem_1fr_5rem_1.5fr_auto] items-start gap-3 border-b border-border/20 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {cue.index}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatCueTimeRange(cue)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {(cueSlotMs(cue) / 1_000).toFixed(1)}s
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm text-foreground">
                        {cue.text}
                      </p>
                      {heavy ? (
                        <span className="mt-1 inline-flex rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          May need heavy compression
                        </span>
                      ) : null}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-lg"
                        disabled={isPreviewing}
                        onClick={() =>
                          isPreviewing ? onStopPreview() : onPreviewCue(cue)
                        }
                      >
                        {isPreviewing ? (
                          <>
                            <LoaderCircle className="size-3.5 animate-spin" />
                            Loading
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5" />
                            Preview
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 sm:hidden">
            {visibleCues.map((cue) => {
              const isPreviewing = previewingCueIndex === cue.index;
              const heavy = mayNeedHeavyCompression(cue);

              return (
                <div
                  key={cue.index}
                  className="rounded-xl border border-border/40 bg-card/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary">
                      Cue {cue.index}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {(cueSlotMs(cue) / 1_000).toFixed(1)}s slot
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatCueTimeRange(cue)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    {cue.text}
                  </p>
                  {heavy ? (
                    <span className="mt-2 inline-flex rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      May need heavy compression
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-3 w-full rounded-lg"
                    disabled={isPreviewing}
                    onClick={() =>
                      isPreviewing ? onStopPreview() : onPreviewCue(cue)
                    }
                  >
                    {isPreviewing ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin" />
                        Loading preview…
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        Preview cue
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function CueSummary({
  cueCount,
  durationMs,
  charCount,
  maxCharacters,
}: {
  cueCount: number;
  durationMs: number;
  charCount: number;
  maxCharacters: number | null;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border/40 bg-card/50 p-4 sm:grid-cols-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cues
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{cueCount}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {formatDuration(durationMs)}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Characters
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {charCount.toLocaleString()}
          {maxCharacters ? (
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {maxCharacters.toLocaleString()}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
