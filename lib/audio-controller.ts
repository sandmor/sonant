const CONTROLLER_KEY = Symbol("audio-controller");

type AudioWithControllerCleanup = HTMLAudioElement & {
  [CONTROLLER_KEY]?: () => void;
};

interface AudioControllerConfig {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onLoad?: (duration: number) => void;
  onError?: () => void;
  currentTimeElement?: HTMLElement | null;
  durationElement?: HTMLElement | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export class AudioController {
  private audio: HTMLAudioElement | null = null;
  private rafId: number | null = null;
  private isUpdating = false;
  private config: AudioControllerConfig;
  private containerElement: HTMLElement;

  constructor(
    containerElement: HTMLElement,
    config: AudioControllerConfig = {},
  ) {
    this.containerElement = containerElement;
    this.config = config;
  }

  private updateDisplay() {
    if (!this.audio) return;

    const currentTime = this.audio.currentTime;
    const duration = this.audio.duration || 0;

    // Update CSS custom properties on container for progress bar
    this.containerElement.style.setProperty(
      "--audio-current-time",
      currentTime.toString(),
    );
    this.containerElement.style.setProperty(
      "--audio-duration",
      duration.toString(),
    );

    if (duration > 0) {
      const progress = (currentTime / duration) * 100;
      this.containerElement.style.setProperty(
        "--audio-progress",
        `${progress}%`,
      );
    }

    if (this.config.currentTimeElement) {
      this.config.currentTimeElement.textContent = formatTime(currentTime);
    }
    if (this.config.durationElement && duration > 0) {
      this.config.durationElement.textContent = formatTime(duration);
    }
  }

  private startUpdateLoop() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    const loop = () => {
      if (!this.isUpdating) return;

      this.updateDisplay();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private stopUpdateLoop() {
    this.isUpdating = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  attach(audio: HTMLAudioElement) {
    this.detach();

    this.audio = audio;

    // Initial duration setup
    const setupDuration = () => {
      const duration = audio.duration || 0;
      if (duration > 0) {
        this.containerElement.style.setProperty(
          "--audio-duration",
          duration.toString(),
        );
        if (this.config.durationElement) {
          this.config.durationElement.textContent = formatTime(duration);
        }
        this.config.onLoad?.(duration);
      }
    };

    if (audio.duration) {
      setupDuration();
    }

    // Event listeners
    const handlePlay = () => {
      this.startUpdateLoop();
      this.config.onPlay?.();
    };

    const handlePause = () => {
      this.stopUpdateLoop();
      this.updateDisplay(); // Final update
      this.config.onPause?.();
    };

    const handleEnded = () => {
      this.stopUpdateLoop();
      this.updateDisplay();
      this.config.onEnded?.();
    };

    const handleLoadedMetadata = () => {
      setupDuration();
    };

    const handleTimeUpdate = () => {
      this.updateDisplay();
    };

    const handleError = () => {
      this.stopUpdateLoop();
      this.config.onError?.();
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("error", handleError);

    const audioWithCleanup = audio as AudioWithControllerCleanup;
    audioWithCleanup[CONTROLLER_KEY] = () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("error", handleError);
    };

    if (!audio.paused) {
      this.startUpdateLoop();
    }
  }

  detach() {
    this.stopUpdateLoop();

    if (this.audio) {
      const audioWithCleanup = this.audio as AudioWithControllerCleanup;
      const cleanup = audioWithCleanup[CONTROLLER_KEY];
      if (cleanup) {
        cleanup();
        delete audioWithCleanup[CONTROLLER_KEY];
      }
      this.audio = null;
    }

    // Reset CSS properties
    this.containerElement.style.removeProperty("--audio-current-time");
    this.containerElement.style.removeProperty("--audio-duration");
    this.containerElement.style.removeProperty("--audio-progress");
  }

  seek(time: number) {
    if (this.audio) {
      this.audio.currentTime = Math.max(
        0,
        Math.min(time, this.audio.duration || 0),
      );
      this.updateDisplay();
    }
  }

  play() {
    if (this.audio) {
      this.audio.play().catch(() => {
        // Ignore - user interaction required
      });
    }
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  toggle() {
    if (this.audio) {
      if (this.audio.paused) {
        this.play();
      } else {
        this.pause();
      }
    }
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  destroy() {
    this.detach();
  }
}

let globalController: AudioController | null = null;

export function getGlobalAudioController(): AudioController | null {
  return globalController;
}

export function createGlobalAudioController(
  containerElement: HTMLElement,
  config?: AudioControllerConfig,
): AudioController {
  if (globalController) {
    globalController.destroy();
  }

  globalController = new AudioController(containerElement, config);
  return globalController;
}

export function pauseAllAudio() {
  document.querySelectorAll("audio").forEach((audio) => {
    if (!audio.paused) {
      audio.pause();
    }
  });
}

export function destroyGlobalAudioController() {
  if (globalController) {
    globalController.destroy();
    globalController = null;
  }
}
