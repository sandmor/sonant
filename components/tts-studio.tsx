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
  Trash2,
  Volume2,
} from "lucide-react";

import { useTheme } from "next-themes";
import { toast } from "sonner";

import { getSourceLabel, makeVoiceKey, parseVoiceKey } from "@/lib/voices";
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
  onLoginFormChange,
  onRegisterFormChange,
  onLoginSubmit,
  onRegisterSubmit,
}: {
  loginForm: AuthFormState;
  registerForm: AuthFormState;
  authBusy: boolean;
  authError: string | null;
  onLoginFormChange: (form: AuthFormState) => void;
  onRegisterFormChange: (form: AuthFormState) => void;
  onLoginSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRegisterSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-md animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        {/* Logo / Brand */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Volume2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-heading text-4xl text-foreground text-glow">
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

              {authError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {authError}
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [generation.id]);

  const audioSrc = generation.audioUrl;

  return (
    <div className="animate-fade-up rounded-2xl border border-border/50 bg-card/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            Now playing
          </p>
          <h3 className="mt-1 truncate text-lg font-medium text-foreground">
            {generation.title}
          </h3>
        </div>
        <WaveformBars count={7} active={isPlaying} />
      </div>

      {/* Custom controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (isPlaying) {
              audio.pause();
            } else {
              audio.play();
            }
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
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

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {voiceLabelFromGeneration(generation)}
            </span>
            <span>·</span>
            <span className="shrink-0">{generation.voiceEngine}</span>
            <span>·</span>
            <span className="shrink-0">{generation.charCount} chars</span>
          </div>
          {/* Single audio instance keeps custom and native controls in sync */}
          <audio
            ref={audioRef}
            key={generation.id}
            className="h-8 w-full opacity-60 hover:opacity-100 transition-opacity"
            controls
            src={audioSrc}
          />
        </div>
      </div>

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
          <a
            href={audioSrc}
            download={`${generation.title.replace(/\s+/g, "-").toLowerCase()}.mp3`}
          >
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
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
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

export function TTSWorkspace() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [openVoicePicker, setOpenVoicePicker] = useState(false);

  useEffect(() => setMounted(true), []);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState<AuthFormState>(initialLoginForm);
  const [registerForm, setRegisterForm] =
    useState<AuthFormState>(initialRegisterForm);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isVoicesLoading, setIsVoicesLoading] = useState(false);

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
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

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);

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
      const localeKey = `${voice.languageName} (${voice.languageCode})`;

      if (!acc[localeKey]) {
        acc[localeKey] = [];
      }

      acc[localeKey].push(voice);
      return acc;
    }, {});
  }, [voices]);

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

  async function loadHistory() {
    setIsHistoryLoading(true);

    try {
      const nextHistory = await fetchHistory();

      setHistory(nextHistory);
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
      setVoices([]);
      setVoiceId("");
      setSelectedGenerationId(null);
      setIsSelectedGenerationLoading(false);
      setSelectedGenerationLoadError(null);
      return;
    }

    void Promise.all([loadVoices(), loadHistory(), loadUsage()]);
  }, [authUser]);

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

    try {
      await register(registerForm);
      const user = await login(registerForm);
      setAuthUser(user);
      setRegisterForm(initialRegisterForm);
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

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const nextGeneration = await generateAudio({
        text,
        voiceSource: parsedVoice.source,
        voiceId: parsedVoice.voiceId,
      });

      setHistory((prev) => [
        nextGeneration,
        ...prev.filter((entry) => entry.id !== nextGeneration.id),
      ]);
      setSelectedGenerationId(nextGeneration.id);
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
    setSelectedGenerationId(generation.id);
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-up">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <LoaderCircle className="size-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading studio…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthScreen
        loginForm={loginForm}
        registerForm={registerForm}
        authBusy={authBusy}
        authError={authError}
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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Volume2 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-heading text-lg text-foreground">Sonant</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-2 w-2 rounded-full bg-emerald-500/80 animate-pulse-glow" />
              <span className="text-xs text-muted-foreground">
                Studio active
              </span>
            </div>

            <div className="h-5 w-px bg-border/60" />

            <UsageIndicator usage={usage} isLoading={isUsageLoading} />

            <div className="h-5 w-px bg-border/60" />

            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
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
        <div className="mx-auto max-w-7xl px-5 py-6 lg:py-8">
          <div className="mb-8 animate-fade-up">
            <h1 className="font-heading text-3xl text-foreground text-glow sm:text-4xl lg:text-5xl">
              Voice Studio
            </h1>
            <p className="mt-2 max-w-lg text-muted-foreground">
              Write your script, choose a voice, and generate a take. Every
              generation lives in your timeline.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            <div
              className="space-y-6 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              <form className="space-y-5" onSubmit={handleGenerate}>
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

                  {/* Quick-pick voice chips */}
                  {voices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {voices.slice(0, 6).map((voice) => {
                        const selectionKey = makeVoiceKey(
                          voice.source,
                          voice.sourceVoiceId,
                        );
                        const isActive = voiceId === selectionKey;

                        return (
                          <button
                            key={`${voice.source}:${voice.sourceVoiceId}`}
                            type="button"
                            onClick={() => setVoiceId(selectionKey)}
                            className={[
                              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                            ].join(" ")}
                          >
                            {voice.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                    <span className="text-xs tabular-nums text-muted-foreground/60">
                      {text.length.toLocaleString()} / 3,000
                    </span>
                  </div>
                  <Textarea
                    id="tts-text"
                    required
                    minLength={1}
                    maxLength={3000}
                    placeholder="Write your narration, podcast copy, ad script, or social content…"
                    className="min-h-48 rounded-xl border-border/40 bg-card/60 p-4 text-[15px] leading-relaxed backdrop-blur-sm placeholder:text-muted-foreground/40 focus-visible:bg-card/80"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
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
                    onReuse={() => applyGenerationToDraft(selectedGeneration)}
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
              <div className="sticky top-20 space-y-4">
                <div className="flex items-center justify-between">
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

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="Search takes…"
                    className="rounded-xl border-border/40 bg-card/60 pl-9 text-sm backdrop-blur-sm placeholder:text-muted-foreground/40"
                  />
                </div>

                {historyError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                    {historyError}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm">
                  <ScrollArea className="h-[calc(100vh-280px)] min-h-75 p-2">
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

                      {filteredHistory.map((entry) => (
                        <HistoryItem
                          key={entry.id}
                          entry={entry}
                          isSelected={
                            effectiveSelectedGenerationId === entry.id
                          }
                          onSelect={() => setSelectedGenerationId(entry.id)}
                          onDelete={() => void handleDeleteGeneration(entry.id)}
                          onReuse={() => applyGenerationToDraft(entry)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
