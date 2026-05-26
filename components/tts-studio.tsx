"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  AudioLines,
  Check,
  ChevronsUpDown,
  Download,
  History,
  LoaderCircle,
  LogOut,
  Mic,
  Moon,
  Play,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import { SonantIcon } from "@/components/sonant-icon";
import Link from "next/link";

import { useTheme } from "next-themes";
import { toast } from "sonner";

import { getSourceLabel, makeVoiceKey, parseVoiceKey } from "@/lib/voices";
import { AudioController } from "@/lib/audio-controller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteGenerationByID,
  fetchGenerationByID,
  fetchHistory,
  fetchUsage,
  fetchVoices,
  generateAudio,
  getSessionUser,
  login,
  logout,
  register,
} from "@/lib/tts/api";
import {
  formatRelativeTime,
  hasPlayableAudio,
  initialLoginForm,
  initialRegisterForm,
  voiceLabelFromGeneration,
  type AuthFormState,
  type AuthUser,
  type Generation,
  type GenerationWithAudio,
  type UsageData,
  type VoiceOption,
} from "@/lib/tts/client";
import { UsageIndicator } from "@/components/usage-indicator";
import { AppSuspenseScreen } from "@/components/app-suspense-screen";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CharacterCounter } from "@/components/ui/character-counter";
import { Pagination } from "@/components/ui/pagination";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useDraftPersistence } from "@/hooks/use-draft-persistence";

function WaveformBars({
  count = 5,
  active = false,
}: {
  count?: number;
  active?: boolean;
}) {
  const idleHeights = useMemo(
    () => Array.from({ length: count }, (_, i) => `${4 + ((i * 7) % 12)}px`),
    [count],
  );

  return (
    <div className="flex h-5 items-end gap-0.75">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={[
            "w-0.75 rounded-full transition-all duration-300",
            active
              ? "bg-primary animate-waveform"
              : "bg-muted-foreground/30 h-1.5",
          ].join(" ")}
          style={{
            animationDelay: active ? `${i * 0.15}s` : undefined,
            height: active ? undefined : idleHeights[i],
          }}
        />
      ))}
    </div>
  );
}

function AuthScreen({
  loginForm,
  registerForm,
  authBusy,
  authError,
  authNotice,
  onLoginFormChange,
  onRegisterFormChange,
  onLoginSubmit,
  onRegisterSubmit,
}: {
  loginForm: AuthFormState;
  registerForm: AuthFormState;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  onLoginFormChange: (form: AuthFormState) => void;
  onRegisterFormChange: (form: AuthFormState) => void;
  onLoginSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRegisterSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div
        className="w-full max-w-md animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        {/* Logo / Brand */}
          <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <SonantIcon className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-heading text-3xl text-foreground text-glow sm:text-4xl">
            Sonant
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your voice. Your studio. No boundaries.
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
          {/* Tab switcher */}
          <div className="mb-6 flex rounded-xl bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setAuthTab("login")}
              className={[
                "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                authTab === "login"
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("register")}
              className={[
                "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                authTab === "register"
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Create account
            </button>
          </div>

          {authTab === "login" ? (
            <form className="space-y-4" onSubmit={onLoginSubmit}>
              <div className="space-y-1.5">
                <Label
                  htmlFor="login-email"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="rounded-xl border-border/50 bg-muted/40 py-2.5 focus-visible:bg-muted/60"
                  value={loginForm.email}
                  onChange={(event) =>
                    onLoginFormChange({
                      ...loginForm,
                      email: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="login-password"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="rounded-xl border-border/50 bg-muted/40 py-2.5 focus-visible:bg-muted/60"
                  value={loginForm.password}
                  onChange={(event) =>
                    onLoginFormChange({
                      ...loginForm,
                      password: event.target.value,
                    })
                  }
                />
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary/90 transition-colors hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>

              {authError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {authError}
                </div>
              ) : null}

              {authNotice ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  {authNotice}
                </div>
              ) : null}

              <Button
                className="w-full rounded-xl py-2.5"
                disabled={authBusy}
                type="submit"
              >
                {authBusy ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onRegisterSubmit}>
              <div className="space-y-1.5">
                <Label
                  htmlFor="register-email"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="rounded-xl border-border/50 bg-muted/40 py-2.5 focus-visible:bg-muted/60"
                  value={registerForm.email}
                  onChange={(event) =>
                    onRegisterFormChange({
                      ...registerForm,
                      email: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="register-password"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="register-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className="rounded-xl border-border/50 bg-muted/40 py-2.5 focus-visible:bg-muted/60"
                  value={registerForm.password}
                  onChange={(event) =>
                    onRegisterFormChange({
                      ...registerForm,
                      password: event.target.value,
                    })
                  }
                />
              </div>

              {authError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {authError}
                </div>
              ) : null}

              {authNotice ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  {authNotice}
                </div>
              ) : null}

              <Button
                className="w-full rounded-xl py-2.5"
                disabled={authBusy}
                type="submit"
              >
                {authBusy ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Powered by neural voice synthesis
        </p>
      </div>
    </div>
  );
}

function PlayerCard({
  generation,
  onReuse,
}: {
  generation: GenerationWithAudio;
  onReuse: () => void;
}) {
  const audioSrc = generation.audioUrl;
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTimeRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef<HTMLSpanElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !audioRef.current) return;

    const controller = new AudioController(containerRef.current, {
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onEnded: () => setIsPlaying(false),
      onLoad: (dur) => setDuration(dur),
      currentTimeElement: currentTimeRef.current,
      durationElement: durationRef.current,
    });

    controller.attach(audioRef.current);

    return () => {
      controller.destroy();
    };
  }, [audioSrc]);

  const handleToggle = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      document.querySelectorAll("audio").forEach((audio) => {
        if (!audio.paused) audio.pause();
      });
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * duration;
    audioRef.current.currentTime = time;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      data-playing={isPlaying}
      className="audio-player-container animate-fade-up rounded-2xl border border-border/50 bg-card/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            Now playing
          </p>
          <h3 className="mt-1 line-clamp-2 break-words text-base leading-tight font-medium text-foreground sm:text-lg sm:line-clamp-1">
            {generation.title}
          </h3>
        </div>
        <WaveformBars count={7} active={isPlaying} />
      </div>

      <div className="audio-controls">
        <button
          type="button"
          onClick={handleToggle}
          className="audio-play-button"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="0" width="4" height="14" rx="1" />
              <rect x="9" y="0" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <Play className="ml-0.5 size-5" fill="currentColor" />
          )}
        </button>

        <div className="audio-info">
          <div className="audio-meta">
            <span className="truncate">
              {voiceLabelFromGeneration(generation)}
            </span>
            <span className="audio-meta-separator">·</span>
            <span className="shrink-0">{generation.voiceEngine}</span>
            <span className="audio-meta-separator">·</span>
            <span className="shrink-0">{generation.charCount} chars</span>
          </div>

          <div className="flex items-center gap-2">
            <span ref={currentTimeRef} className="audio-time">
              0:00
            </span>
            <div
              className="audio-progress-bar"
              onClick={handleSeek}
              aria-label="Seek"
            >
              <div className="audio-progress-fill" />
            </div>
            <span ref={durationRef} className="audio-time">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioSrc}
        className="audio-element"
        preload="metadata"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={onReuse}
        >
          <RefreshCw className="size-3.5" />
          Reuse as draft
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-xl gap-1.5"
        >
          <a href={`/api/tts/history/${generation.id}/download`}>
            <Download className="size-3.5" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}

function HistoryItem({
  entry,
  isSelected,
  onSelect,
  onDelete,
  onReuse,
}: {
  entry: Generation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onReuse: () => void;
}) {
  return (
    <div
      className={[
        "group relative rounded-xl border p-3.5 transition-all duration-200 cursor-pointer",
        isSelected
          ? "border-primary/30 bg-primary/8 shadow-sm shadow-primary/5"
          : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-border/40",
      ].join(" ")}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium text-foreground">
            {entry.title}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {entry.inputText}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReuse();
            }}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Reuse as draft"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <InlineConfirm
              onConfirm={onDelete}
              confirmLabel="Delete"
              cancelLabel="Cancel"
              variant="destructive"
              aria-label="Delete generation"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-medium">
          {entry.voiceName}
        </span>
        <span>{formatRelativeTime(entry.createdAt)}</span>
      </div>

      {isSelected && (
        <div className="absolute left-0 top-3 bottom-3 w-0.75 rounded-full bg-primary" />
      )}
    </div>
  );
}

const QWEN_LANGUAGES = [
  "English",
  "Chinese",
  "French",
  "Spanish",
  "Korean",
  "Japanese",
  "German",
  "Italian",
  "Russian",
  "Portuguese",
  "Dutch",
  "Turkish",
  "Arabic",
  "Polish",
  "Indonesian",
  "Vietnamese",
];

function TTSWorkspaceContent() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [openVoicePicker, setOpenVoicePicker] = useState(false);

  useEffect(() => setMounted(true), []);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState<AuthFormState>(initialLoginForm);
  const [registerForm, setRegisterForm] =
    useState<AuthFormState>(initialRegisterForm);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isVoicesLoading, setIsVoicesLoading] = useState(false);

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("English");
  const [openLanguagePicker, setOpenLanguagePicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [history, setHistory] = useState<Generation[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSelectedGenerationLoading, setIsSelectedGenerationLoading] =
    useState(false);
  const [selectedGenerationLoadError, setSelectedGenerationLoadError] =
    useState<string | null>(null);
  const [selectedGenerationId, setSelectedGenerationId] = useState<
    number | null
  >(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<Generation | null>(
    null,
  );

  // Draft persistence
  useDraftPersistence(text, setText);

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);

  const maxCharactersPerRequest =
    typeof usage?.maxCharactersPerRequest === "number" &&
    Number.isFinite(usage.maxCharactersPerRequest)
      ? Math.max(0, Math.floor(usage.maxCharactersPerRequest))
      : null;

  const voiceByKey = useMemo(() => {
    return new Map(
      voices.map((voice) => [
        makeVoiceKey(voice.source, voice.sourceVoiceId),
        voice,
      ]),
    );
  }, [voices]);

  const groupedVoices = useMemo(() => {
    return voices.reduce<Record<string, VoiceOption[]>>((acc, voice) => {
      const localeKey =
        voice.source === "qwen"
          ? "Multilingual Models"
          : `${voice.languageName} (${voice.languageCode})`;

      if (!acc[localeKey]) {
        acc[localeKey] = [];
      }

      acc[localeKey].push(voice);
      return acc;
    }, {});
  }, [voices]);

  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();

    if (!query) {
      return history;
    }

    return history.filter((entry) => {
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.inputText.toLowerCase().includes(query) ||
        entry.sourceVoiceId.toLowerCase().includes(query) ||
        entry.voiceName.toLowerCase().includes(query) ||
        entry.voiceSource.toLowerCase().includes(query)
      );
    });
  }, [history, historyQuery]);

  // Use local history as is for now since it's already paginated on backend
  const paginatedHistory = filteredHistory;

  const totalPages = historyQuery
    ? Math.ceil(filteredHistory.length / itemsPerPage)
    : historyTotalPages;

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [historyQuery]);

  const selectedGeneration = useMemo(() => {
    if (selectedGenerationId) {
      return history.find((entry) => entry.id === selectedGenerationId) ?? null;
    }

    return history[0] ?? null;
  }, [history, selectedGenerationId]);

  const selectedGenerationForAudioId = selectedGeneration?.id ?? null;
  const selectedGenerationHasAudio = selectedGeneration
    ? hasPlayableAudio(selectedGeneration)
    : false;

  // Track original text for unsaved changes detection
  const [originalText, setOriginalText] = useState("");
  const hasUnsavedChanges = useMemo(() => {
    return text.trim() !== originalText.trim() && text.trim().length > 0;
  }, [text, originalText]);

  async function loadHistory(page = 1) {
    setIsHistoryLoading(true);

    try {
      const { docs: nextHistory, totalPages: fetchTotalPages } =
        await fetchHistory(page, itemsPerPage);

      setHistory(nextHistory);
      setHistoryTotalPages(fetchTotalPages);
      setHistoryError(null);
      setSelectedGenerationLoadError(null);
      setSelectedGenerationId((current) => {
        if (current && nextHistory.some((entry) => entry.id === current)) {
          return current;
        }

        return nextHistory[0]?.id ?? null;
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        setAuthUser(null);
      }

      const message =
        error instanceof Error ? error.message : "Unable to load timeline";
      setHistoryError(message);

      if (message !== "Unauthorized") {
        toast.error(message);
      }
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function loadVoices() {
    setIsVoicesLoading(true);

    try {
      const loadedVoices = await fetchVoices();

      setVoices(loadedVoices);
      setGenerationError(null);

      setVoiceId((current) => {
        if (
          current &&
          loadedVoices.some(
            (voice) =>
              makeVoiceKey(voice.source, voice.sourceVoiceId) === current,
          )
        ) {
          return current;
        }

        const preferred = loadedVoices.find((voice) => voice.isDefault);
        if (preferred) {
          return makeVoiceKey(preferred.source, preferred.sourceVoiceId);
        }

        return "";
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        setAuthUser(null);
      }

      const message =
        error instanceof Error ? error.message : "Unable to load voices";
      setGenerationError(message);

      if (message !== "Unauthorized") {
        toast.error(message);
      }
    } finally {
      setIsVoicesLoading(false);
    }
  }

  async function loadUsage() {
    setIsUsageLoading(true);

    try {
      const usageData = await fetchUsage();
      setUsage(usageData);
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        setAuthUser(null);
      }
      // Silently fail - usage is not critical
    } finally {
      setIsUsageLoading(false);
    }
  }

  async function loadGenerationById(id: number) {
    setIsSelectedGenerationLoading(true);
    setSelectedGenerationLoadError(null);

    try {
      const nextGeneration = await fetchGenerationByID(id);

      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, ...nextGeneration } : entry,
        ),
      );

      if (!hasPlayableAudio(nextGeneration)) {
        setSelectedGenerationLoadError(
          "Audio was not present for the selected generation",
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        setAuthUser(null);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load selected audio";
      setSelectedGenerationLoadError(message);
      toast.error(message);
    } finally {
      setIsSelectedGenerationLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const user = await getSessionUser();

        if (!isMounted) {
          return;
        }

        setAuthUser(user);
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setHistory([]);
      setHistoryTotalPages(1);
      setUsage(null);
      setVoices([]);
      setVoiceId("");
      setSelectedGenerationId(null);
      setIsSelectedGenerationLoading(false);
      setSelectedGenerationLoadError(null);
      return;
    }

    void Promise.all([loadVoices(), loadHistory(currentPage), loadUsage()]);
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      void loadHistory(currentPage);
    }
  }, [currentPage]);

  useEffect(() => {
    if (!selectedGenerationForAudioId) {
      setIsSelectedGenerationLoading(false);
      setSelectedGenerationLoadError(null);
      return;
    }

    if (selectedGenerationHasAudio) {
      setIsSelectedGenerationLoading(false);
      setSelectedGenerationLoadError(null);
      return;
    }

    void loadGenerationById(selectedGenerationForAudioId);
  }, [selectedGenerationForAudioId, selectedGenerationHasAudio]);

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const user = await login(loginForm);
      setAuthUser(user);
      setLoginForm(initialLoginForm);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log in";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const email = registerForm.email;

      await register(registerForm);
      setRegisterForm(initialRegisterForm);

      const sessionUser = await getSessionUser();

      if (sessionUser) {
        setAuthUser(sessionUser);
        setLoginForm(initialLoginForm);
        return;
      }

      setLoginForm((current) => ({
        ...current,
        email,
        password: "",
      }));
      setAuthNotice(
        "Account created. Please verify your email from the inbox link before signing in.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create account";

      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    setAuthError(null);

    try {
      await logout();
    } finally {
      setAuthBusy(false);
      setAuthUser(null);
    }
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedVoice = parseVoiceKey(voiceId);

    if (!parsedVoice) {
      setGenerationError("Please select a valid voice before generating");
      return;
    }

    // Pause any playing audio before generating
    document.querySelectorAll("audio").forEach((audio) => {
      if (!audio.paused) audio.pause();
    });

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const nextGeneration = await generateAudio({
        text,
        voiceSource: parsedVoice.source,
        voiceId: parsedVoice.voiceId,
        language: parsedVoice.source === "qwen" ? language : undefined,
      });

      setHistory((prev) => [
        nextGeneration,
        ...prev.filter((entry) => entry.id !== nextGeneration.id),
      ]);
      setSelectedGenerationId(nextGeneration.id);

      // Update original text to mark as saved
      setOriginalText(text);

      toast.success("Audio generated successfully");

      // Refresh usage data after successful generation
      void loadUsage();
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        setAuthUser(null);
      }

      const message =
        error instanceof Error ? error.message : "Unable to generate audio";
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDeleteGeneration(id: number) {
    try {
      await deleteGenerationByID(id);
      setHistoryError(null);
      setHistory((prev) => {
        const remainingHistory = prev.filter((entry) => entry.id !== id);
        setSelectedGenerationId((current) =>
          current === id ? (remainingHistory[0]?.id ?? null) : current,
        );
        return remainingHistory;
      });

      if (selectedGenerationForAudioId === id) {
        setSelectedGenerationLoadError(null);
      }

      toast.success("Generation deleted");
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        setAuthUser(null);
      }

      const message =
        error instanceof Error ? error.message : "Unable to delete generation";
      setHistoryError(message);
      toast.error(message);
    }
  }

  function applyGenerationToDraft(generation: Generation) {
    setText(generation.inputText);
    setVoiceId(makeVoiceKey(generation.voiceSource, generation.sourceVoiceId));
    if (generation.voiceSource === "qwen" && generation.voiceLocale) {
      setLanguage(generation.voiceLocale);
    }
    setSelectedGenerationId(generation.id);
    // Update original text since we're explicitly loading
    setOriginalText(generation.inputText);
  }

  function handleReuseWithCheck(generation: Generation) {
    if (hasUnsavedChanges && text.trim() !== generation.inputText.trim()) {
      setPendingGeneration(generation);
      setShowUnsavedDialog(true);
    } else {
      applyGenerationToDraft(generation);
    }
  }

  function handleConfirmReuse() {
    if (pendingGeneration) {
      applyGenerationToDraft(pendingGeneration);
      setPendingGeneration(null);
    }
    setShowUnsavedDialog(false);
  }

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "Enter",
      modifier: "meta",
      action: () => {
        if (!isGenerating && text.trim().length > 0 && voiceId) {
          const form = document.getElementById("tts-form") as HTMLFormElement;
          form?.requestSubmit();
        }
      },
      condition: () => !isGenerating && text.trim().length > 0 && !!voiceId,
    },
    {
      key: "Escape",
      action: () => setOpenVoicePicker(false),
      condition: () => openVoicePicker,
    },
  ]);

  if (isCheckingSession) {
    return <AppSuspenseScreen message="Loading studio..." />;
  }

  if (!authUser) {
    return (
      <AuthScreen
        loginForm={loginForm}
        registerForm={registerForm}
        authBusy={authBusy}
        authError={authError}
        authNotice={authNotice}
        onLoginFormChange={setLoginForm}
        onRegisterFormChange={setRegisterForm}
        onLoginSubmit={handleLoginSubmit}
        onRegisterSubmit={handleRegisterSubmit}
      />
    );
  }

  const selectedVoice = voiceId ? voiceByKey.get(voiceId) : undefined;
  const effectiveSelectedGenerationId =
    selectedGenerationId ?? selectedGeneration?.id ?? null;

  return (
    <div className="grain-overlay relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-5 sm:py-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <SonantIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="font-heading text-lg text-foreground">Sonant</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <UsageIndicator usage={usage} isLoading={isUsageLoading} />

            <div className="hidden h-5 w-px bg-border/60 sm:block" />

            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary sm:h-7 sm:w-7">
                {(authUser.name ?? authUser.email).slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden text-sm text-foreground sm:inline">
                {authUser.name ?? authUser.email.split("@")[0]}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Toggle theme"
            >
              {mounted ? (
                resolvedTheme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )
              ) : (
                <div className="size-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </button>

            <button
              type="button"
              disabled={authBusy}
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Sign out"
            >
              {authBusy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:py-8">
          <div className="mb-8 animate-fade-up">
            <h1 className="font-heading text-3xl text-foreground text-glow sm:text-4xl lg:text-5xl">
              Sonant
            </h1>
            <p className="mt-2 max-w-lg text-muted-foreground">
              Write your script, choose a voice, and generate a take. Every
              generation lives in your timeline.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            <div
              className="min-w-0 space-y-6 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              <form
                id="tts-form"
                className="space-y-5"
                onSubmit={handleGenerate}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mic className="size-4 text-primary" />
                    <Label
                      htmlFor="voice-id"
                      className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      Voice
                    </Label>
                  </div>

                  <Popover
                    open={openVoicePicker}
                    onOpenChange={setOpenVoicePicker}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openVoicePicker}
                        className="w-full justify-between rounded-xl border-border/40 bg-card/60 py-6 text-[15px] font-normal backdrop-blur-sm hover:bg-card/80 hover:text-foreground"
                      >
                        {selectedVoice
                          ? `${selectedVoice.name} — ${getSourceLabel(selectedVoice.source)}`
                          : "Select a voice..."}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 rounded-xl border-border/50 bg-card/95 backdrop-blur-xl"
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                    >
                      <Command defaultValue={voiceId}>
                        <CommandInput
                          placeholder="Search voices by name or language..."
                          className="w-full border-none focus:ring-0"
                        />
                        <CommandList className="max-h-75">
                          <CommandEmpty>No voice found.</CommandEmpty>
                          {Object.entries(groupedVoices).map(
                            ([locale, localeVoices]) => (
                              <CommandGroup
                                key={locale}
                                heading={locale}
                                className="text-muted-foreground"
                              >
                                {localeVoices.map((voice) => {
                                  const voiceVal = makeVoiceKey(
                                    voice.source,
                                    voice.sourceVoiceId,
                                  );
                                  return (
                                    <CommandItem
                                      key={voiceVal}
                                      value={voiceVal}
                                      keywords={[
                                        voice.name,
                                        locale,
                                        getSourceLabel(voice.source),
                                      ]}
                                      onSelect={() => {
                                        setVoiceId(voiceVal);
                                        setOpenVoicePicker(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 size-4",
                                          voiceId === voiceVal
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      {voice.name} —{" "}
                                      {getSourceLabel(voice.source)}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            ),
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedVoice?.source === "qwen" && (
                    <div
                      className="pt-2 animate-fade-up"
                      style={{ animationDelay: "0.1s" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <AudioLines className="size-4 text-primary" />
                        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Language
                        </Label>
                      </div>
                      <Popover
                        open={openLanguagePicker}
                        onOpenChange={setOpenLanguagePicker}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openLanguagePicker}
                            className="w-full justify-between rounded-xl border-border/40 bg-card/60 py-6 text-[15px] font-normal backdrop-blur-sm hover:bg-card/80 hover:text-foreground"
                          >
                            {language || "Select language..."}
                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 rounded-xl border-border/50 bg-card/95 backdrop-blur-xl"
                          style={{
                            width: "var(--radix-popover-trigger-width)",
                          }}
                        >
                          <Command>
                            <CommandInput
                              placeholder="Search language..."
                              className="w-full border-none focus:ring-0"
                            />
                            <CommandList className="max-h-75">
                              <CommandEmpty>No language found.</CommandEmpty>
                              <CommandGroup>
                                {QWEN_LANGUAGES.map((lang) => (
                                  <CommandItem
                                    key={lang}
                                    value={lang}
                                    onSelect={(currentValue) => {
                                      setLanguage(lang);
                                      setOpenLanguagePicker(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 size-4",
                                        language === lang
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {lang}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {isVoicesLoading ? (
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <LoaderCircle className="size-3 animate-spin" />
                      Syncing voices…
                    </div>
                  ) : null}

                  {!isVoicesLoading && voices.length === 0 ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                      No voices available. An admin needs to enable voices
                      first.
                    </div>
                  ) : null}
                </div>

                {/* Script textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="tts-text"
                      className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      Script
                    </Label>
                    {hasUnsavedChanges && (
                      <span className="text-[10px] text-amber-500 font-medium">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="tts-text"
                    required
                    minLength={1}
                    maxLength={
                      typeof maxCharactersPerRequest === "number" &&
                      maxCharactersPerRequest > 0
                        ? maxCharactersPerRequest
                        : undefined
                    }
                    placeholder="Write your narration, podcast copy, ad script, or social content…"
                    className="min-h-40 rounded-xl border-border/40 bg-card/60 p-4 text-[15px] leading-relaxed backdrop-blur-sm placeholder:text-muted-foreground/40 focus-visible:bg-card/80 sm:min-h-48"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                  <CharacterCounter
                    current={text.length}
                    max={maxCharactersPerRequest}
                    warningThreshold={0.8}
                    criticalThreshold={0.95}
                  />
                </div>

                {generationError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                    {generationError}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-xl py-3 text-sm font-semibold tracking-wide shadow-lg shadow-primary/15 transition-all hover:shadow-primary/25"
                  disabled={
                    isGenerating ||
                    text.trim().length === 0 ||
                    isVoicesLoading ||
                    !voiceId
                  }
                >
                  {isGenerating ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>Generate take</>
                  )}
                </Button>
              </form>

              {selectedGeneration ? (
                hasPlayableAudio(selectedGeneration) ? (
                  <PlayerCard
                    generation={selectedGeneration}
                    onReuse={() => handleReuseWithCheck(selectedGeneration)}
                  />
                ) : (
                  <div className="animate-fade-up rounded-2xl border border-border/50 bg-card/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {isSelectedGenerationLoading ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Loading selected audio…
                        </>
                      ) : (
                        <>
                          <AudioLines className="size-4" />
                          {selectedGenerationLoadError ||
                            "Audio unavailable for this item."}
                        </>
                      )}
                    </div>
                    {!isSelectedGenerationLoading ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3 rounded-xl"
                        onClick={() =>
                          void loadGenerationById(selectedGeneration.id)
                        }
                      >
                        Retry loading audio
                      </Button>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>

            <aside
              className="animate-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="flex flex-col lg:sticky lg:top-20 lg:h-[calc(100dvh-120px)] lg:min-h-128">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">
                      Timeline
                    </h2>
                  </div>
                  <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {filteredHistory.length}
                  </span>
                </div>

                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="Search takes…"
                    className="rounded-xl border-border/40 bg-card/60 pl-9 text-sm backdrop-blur-sm placeholder:text-muted-foreground/40"
                  />
                </div>

                {historyError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive mb-4">
                    {historyError}
                  </div>
                ) : null}

                <div className="flex-1 min-h-0 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1 p-2 [&>[data-radix-scroll-area-viewport]]:max-h-[calc(100dvh-280px)]">
                    <div className="space-y-1.5">
                      {isHistoryLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <LoaderCircle className="size-5 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">
                              Loading timeline…
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {!isHistoryLoading && filteredHistory.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
                            <AudioLines className="size-5 text-muted-foreground/40" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              No takes yet
                            </p>
                            <p className="text-xs text-muted-foreground/60">
                              Your first generation will appear here
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {paginatedHistory.map((entry) => (
                        <HistoryItem
                          key={entry.id}
                          entry={entry}
                          isSelected={
                            effectiveSelectedGenerationId === entry.id
                          }
                          onSelect={() => {
                            // Pause audio when switching history items
                            document
                              .querySelectorAll("audio")
                              .forEach((audio) => {
                                if (!audio.paused) audio.pause();
                              });
                            setSelectedGenerationId(entry.id);
                          }}
                          onDelete={() => void handleDeleteGeneration(entry.id)}
                          onReuse={() => handleReuseWithCheck(entry)}
                        />
                      ))}
                    </div>
                  </ScrollArea>

                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredHistory.length}
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Unsaved Changes Dialog */}
      <ConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        title="Unsaved Changes"
        description={`You have ${text.length} characters of unsaved text. Reusing this draft will replace your current content.`}
        onConfirm={handleConfirmReuse}
        onCancel={() => {
          setPendingGeneration(null);
          setShowUnsavedDialog(false);
        }}
        confirmText="Replace & Continue"
        cancelText="Keep Current"
        variant="destructive"
      />
    </div>
  );
}

export function TTSWorkspace() {
  return <TTSWorkspaceContent />;
}
