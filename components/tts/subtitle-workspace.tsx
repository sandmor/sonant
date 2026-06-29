"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  LoaderCircle,
  Mic,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LanguagePicker } from "@/components/tts/language-picker";
import { VoicePicker } from "@/components/tts/voice-picker";
import { ModalEngineSelector } from "@/components/tts/modal-engine-selector";
import { CueSummary, CueTable } from "@/components/tts/cue-table";
import {
  cancelSrtJob,
  createSrtJob,
  getSrtJob,
  previewSrtCue,
} from "@/lib/tts/api";
import type { Generation, SrtFitSettings, SrtJob } from "@/lib/tts/client";
import {
  isValidSrt,
  parseSrt,
  totalChars,
  totalDurationMs,
  type SrtCue,
} from "@/lib/tts/srt";
import {
  isModalEngineSource,
  parseVoiceKey,
  type ModalEngineSource,
} from "@/lib/voices";
import type { VoiceOption } from "@/lib/tts/client";

type SubtitleWorkspaceProps = {
  voices: VoiceOption[];
  languages: Array<{ id: string; label: string }>;
  isVoicesLoading: boolean;
  isLanguagesLoading: boolean;
  engine: ModalEngineSource;
  voiceId: string;
  language: string;
  maxCharactersPerRequest: number | null;
  srtFilename: string;
  srtText: string;
  fitSettings: SrtFitSettings;
  onEngineChange: (engine: ModalEngineSource) => void;
  onVoiceChange: (voiceId: string) => void;
  onLanguageChange: (language: string) => void;
  onSrtLoaded: (args: { filename: string; text: string; cues: SrtCue[] }) => void;
  onSrtClear: () => void;
  onFitSettingsChange: (fit: SrtFitSettings) => void;
  onJobCompleted: (generation: Generation) => void;
  onUsageRefresh: () => void;
};

const POLL_INTERVAL_MS = 2_000;

export function SubtitleWorkspace({
  voices,
  languages,
  isVoicesLoading,
  isLanguagesLoading,
  engine,
  voiceId,
  language,
  maxCharactersPerRequest,
  srtFilename,
  srtText,
  fitSettings,
  onEngineChange,
  onVoiceChange,
  onLanguageChange,
  onSrtLoaded,
  onSrtClear,
  onFitSettingsChange,
  onJobCompleted,
  onUsageRefresh,
}: SubtitleWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cueQuery, setCueQuery] = useState("");
  const [openVoicePicker, setOpenVoicePicker] = useState(false);
  const [openLanguagePicker, setOpenLanguagePicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewingCueIndex, setPreviewingCueIndex] = useState<number | null>(
    null,
  );
  const [activeJob, setActiveJob] = useState<SrtJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsed = useMemo(() => {
    if (!srtText.trim()) {
      return null;
    }

    return parseSrt(srtText);
  }, [srtText]);

  const cues = parsed?.cues ?? [];
  const parseErrors = parsed?.errors.map((error) => error.message) ?? [];
  const parseWarnings = parsed?.warnings.map((warning) => warning.message) ?? [];

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      previewAudioRef.current?.pause();
    };
  }, []);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".srt")) {
      toast.error("Please upload a .srt file");
      return;
    }

    const text = await file.text();
    const result = parseSrt(text);

    if (!isValidSrt(result)) {
      toast.error("Invalid SRT file");
      return;
    }

    onSrtLoaded({
      filename: file.name,
      text,
      cues: result.cues,
    });
    setJobError(null);
    toast.success(`Loaded ${result.cues.length} cues`);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function pollJob(jobId: number) {
    try {
      const job = await getSrtJob(jobId);
      setActiveJob(job);

      if (job.status === "completed" && job.generation) {
        stopPolling();
        setIsSubmitting(false);
        onJobCompleted(job.generation);
        onUsageRefresh();
        toast.success("Timed audio generated");
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        stopPolling();
        setIsSubmitting(false);
        setJobError(job.error ?? "SRT job failed");
        toast.error(job.error ?? "SRT job failed");
      }
    } catch (error) {
      stopPolling();
      setIsSubmitting(false);
      const message =
        error instanceof Error ? error.message : "Unable to poll SRT job";
      setJobError(message);
      toast.error(message);
    }
  }

  function startPolling(jobId: number) {
    stopPolling();
    void pollJob(jobId);
    pollTimerRef.current = setInterval(() => {
      void pollJob(jobId);
    }, POLL_INTERVAL_MS);
  }

  async function handleGenerate() {
    const parsedVoice = parseVoiceKey(voiceId);
    if (!parsedVoice || !isModalEngineSource(parsedVoice.source)) {
      setJobError("Please select a valid voice");
      return;
    }

    if (!srtText.trim() || cues.length === 0 || parseErrors.length > 0) {
      setJobError("Upload a valid SRT file first");
      return;
    }

    setIsSubmitting(true);
    setJobError(null);
    previewAudioRef.current?.pause();

    try {
      const job = await createSrtJob({
        srtText,
        srtFilename: srtFilename || "subtitles.srt",
        engine: parsedVoice.source,
        voiceId: parsedVoice.voiceId,
        language,
        fit: fitSettings,
      });

      setActiveJob(job);
      startPolling(job.id);
    } catch (error) {
      setIsSubmitting(false);
      const message =
        error instanceof Error ? error.message : "Unable to start SRT job";
      setJobError(message);
      toast.error(message);
    }
  }

  async function handleCancelJob() {
    if (!activeJob) {
      return;
    }

    try {
      await cancelSrtJob(activeJob.id);
      stopPolling();
      setIsSubmitting(false);
      setActiveJob((current) =>
        current
          ? { ...current, status: "cancelled", error: "Cancelled by user" }
          : current,
      );
      toast.message("Job cancelled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel job",
      );
    }
  }

  async function handlePreviewCue(cue: SrtCue) {
    const parsedVoice = parseVoiceKey(voiceId);
    if (!parsedVoice || !isModalEngineSource(parsedVoice.source)) {
      toast.error("Select a voice before previewing");
      return;
    }

    setPreviewingCueIndex(cue.index);
    previewAudioRef.current?.pause();

    try {
      const blob = await previewSrtCue({
        engine: parsedVoice.source,
        voiceId: parsedVoice.voiceId,
        language,
        cue,
        fit: fitSettings,
      });

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPreviewingCueIndex(null);
      };
      await audio.play();
    } catch (error) {
      setPreviewingCueIndex(null);
      toast.error(
        error instanceof Error ? error.message : "Unable to preview cue",
      );
    }
  }

  function handleStopPreview() {
    previewAudioRef.current?.pause();
    setPreviewingCueIndex(null);
  }

  const progressPercent =
    activeJob && activeJob.cuesTotal > 0
      ? Math.round((activeJob.cuesDone / activeJob.cuesTotal) * 100)
      : 0;

  const progressLabel =
    activeJob?.phase === "postprocessing"
      ? "Building timeline…"
      : "Synthesizing cues…";

  const canGenerate =
    cues.length > 0 &&
    parseErrors.length === 0 &&
    voiceId &&
    !isVoicesLoading &&
    !isSubmitting;

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="size-4 text-primary" />
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Import SRT
          </Label>
        </div>

        {!srtFilename ? (
          <div
            className={[
              "rounded-2xl border border-dashed px-4 py-10 text-center transition-colors sm:py-12",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border/50 bg-card/40",
            ].join(" ")}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) {
                void handleFile(file);
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".srt,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
                event.target.value = "";
              }}
            />
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop your .srt file here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or tap to browse on mobile
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose SRT file
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 bg-card/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {srtFilename}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cues.length} cues loaded
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-lg"
                  onClick={onSrtClear}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".srt,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
                event.target.value = "";
              }}
            />
          </div>
        )}

        {parseErrors.length > 0 ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            <ul className="list-disc space-y-1 pl-4">
              {parseErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {parseWarnings.length > 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <ul className="list-disc space-y-1 pl-4">
              {parseWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {cues.length > 0 && parseErrors.length === 0 ? (
        <>
          <CueSummary
            cueCount={cues.length}
            durationMs={totalDurationMs(cues)}
            charCount={totalChars(cues)}
            maxCharacters={maxCharactersPerRequest}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" />
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Engine
              </Label>
            </div>
            <ModalEngineSelector value={engine} onChange={onEngineChange} />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Voice
            </Label>
            <VoicePicker
              engine={engine}
              voices={voices}
              voiceId={voiceId}
              open={openVoicePicker}
              onOpenChange={setOpenVoicePicker}
              onVoiceChange={onVoiceChange}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Language
            </Label>
            <LanguagePicker
              languages={languages}
              language={language}
              open={openLanguagePicker}
              onOpenChange={setOpenLanguagePicker}
              onLanguageChange={onLanguageChange}
            />
            {isLanguagesLoading ? (
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="size-3 animate-spin" />
                Loading languages…
              </div>
            ) : null}
          </div>

          <details className="rounded-xl border border-border/40 bg-card/40 p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Fit settings
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1.5, 2, 3].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={
                    fitSettings.maxSpeedup === value ? "default" : "secondary"
                  }
                  className="rounded-lg"
                  onClick={() =>
                    onFitSettingsChange({
                      maxSpeedup: value,
                      mode: "compress_and_pad",
                    })
                  }
                >
                  Max {value}x compress
                </Button>
              ))}
            </div>
          </details>

          <CueTable
            cues={cues}
            query={cueQuery}
            onQueryChange={setCueQuery}
            previewingCueIndex={previewingCueIndex}
            onPreviewCue={(cue) => void handlePreviewCue(cue)}
            onStopPreview={handleStopPreview}
          />

          {jobError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {jobError}
            </div>
          ) : null}

          {activeJob &&
          (activeJob.status === "running" || activeJob.status === "pending") ? (
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {progressLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {activeJob.cuesDone} / {activeJob.cuesTotal} cues ·{" "}
                    {progressPercent}%
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-lg"
                  onClick={() => void handleCancelJob()}
                >
                  Cancel
                </Button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="hidden sm:block">
            <Button
              type="button"
              size="lg"
              className="w-full rounded-xl py-3 text-sm font-semibold tracking-wide shadow-lg shadow-primary/15"
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Generating timed audio…
                </>
              ) : (
                "Generate timed audio"
              )}
            </Button>
          </div>
        </>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 p-3 backdrop-blur-xl sm:hidden">
        {activeJob &&
        (activeJob.status === "running" || activeJob.status === "pending") ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressLabel}</span>
              <span>
                {activeJob.cuesDone}/{activeJob.cuesTotal} · {progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-xl"
              onClick={() => void handleCancelJob()}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full rounded-xl py-3 font-semibold"
            disabled={!canGenerate}
            onClick={() => void handleGenerate()}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate timed audio"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
