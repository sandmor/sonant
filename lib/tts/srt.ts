export type SrtCue = {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type SrtParseWarning = {
  code: "empty_cue" | "skipped_cue";
  message: string;
  cueIndex?: number;
  line?: number;
};

export type SrtParseError = {
  code:
    | "malformed_timestamp"
    | "invalid_order"
    | "overlap"
    | "empty_file"
    | "invalid_cue_index";
  message: string;
  line?: number;
  cueIndex?: number;
};

export type SrtParseResult = {
  cues: SrtCue[];
  warnings: SrtParseWarning[];
  errors: SrtParseError[];
};

const TIMESTAMP_RE =
  /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/;

function parseTimestampToMs(
  hours: string,
  minutes: string,
  seconds: string,
  millis: string,
): number {
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(millis)
  );
}

function formatSrtTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1_000);
  const millis = clamped % 1_000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function formatCueTimeRange(cue: SrtCue): string {
  return `${formatSrtTime(cue.startMs)} → ${formatSrtTime(cue.endMs)}`;
}

export function cueSlotMs(cue: SrtCue): number {
  return Math.max(0, cue.endMs - cue.startMs);
}

export function totalDurationMs(cues: SrtCue[]): number {
  if (cues.length === 0) {
    return 0;
  }

  return Math.max(...cues.map((cue) => cue.endMs));
}

export function totalChars(cues: SrtCue[]): number {
  return cues.reduce((sum, cue) => sum + cue.text.length, 0);
}

/** Heuristic: flag cues where text density may require heavy compression. */
export function mayNeedHeavyCompression(
  cue: SrtCue,
  charsPerSecondThreshold = 18,
): boolean {
  const slotSec = cueSlotMs(cue) / 1_000;
  if (slotSec <= 0) {
    return true;
  }

  return cue.text.length / slotSec > charsPerSecondThreshold;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function parseSrt(rawText: string): SrtParseResult {
  const warnings: SrtParseWarning[] = [];
  const errors: SrtParseError[] = [];
  const cues: SrtCue[] = [];

  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!normalized) {
    return {
      cues: [],
      warnings,
      errors: [
        {
          code: "empty_file",
          message: "SRT file is empty",
        },
      ],
    };
  }

  const blocks = normalized.split(/\n{2,}/);
  let previousEndMs = -1;
  let lineOffset = 1;

  for (const block of blocks) {
    const lines = block.split("\n");
    const blockStartLine = lineOffset;

    if (lines.length < 2) {
      lineOffset += lines.length + 1;
      continue;
    }

    const indexLine = lines[0]?.trim() ?? "";
    const timestampLine = lines[1]?.trim() ?? "";
    const cueIndex = Number(indexLine);

    if (!Number.isInteger(cueIndex) || cueIndex <= 0) {
      errors.push({
        code: "invalid_cue_index",
        message: `Invalid cue index '${indexLine}'`,
        line: blockStartLine,
      });
      lineOffset += lines.length + 1;
      continue;
    }

    const timestampMatch = TIMESTAMP_RE.exec(timestampLine);
    if (!timestampMatch) {
      errors.push({
        code: "malformed_timestamp",
        message: `Malformed timestamp on line ${blockStartLine + 1}`,
        line: blockStartLine + 1,
        cueIndex,
      });
      lineOffset += lines.length + 1;
      continue;
    }

    const startMs = parseTimestampToMs(
      timestampMatch[1],
      timestampMatch[2],
      timestampMatch[3],
      timestampMatch[4],
    );
    const endMs = parseTimestampToMs(
      timestampMatch[5],
      timestampMatch[6],
      timestampMatch[7],
      timestampMatch[8],
    );

    if (endMs <= startMs) {
      errors.push({
        code: "malformed_timestamp",
        message: `Cue ${cueIndex} end time must be after start time`,
        line: blockStartLine + 1,
        cueIndex,
      });
      lineOffset += lines.length + 1;
      continue;
    }

    if (startMs < previousEndMs) {
      errors.push({
        code: "overlap",
        message: `Cue ${cueIndex} overlaps with a previous cue`,
        line: blockStartLine + 1,
        cueIndex,
      });
      lineOffset += lines.length + 1;
      continue;
    }

    const text = lines
      .slice(2)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!text) {
      warnings.push({
        code: "empty_cue",
        message: `Cue ${cueIndex} has no text and was skipped`,
        cueIndex,
        line: blockStartLine,
      });
      lineOffset += lines.length + 1;
      continue;
    }

    if (previousEndMs >= 0 && startMs < previousEndMs) {
      errors.push({
        code: "overlap",
        message: `Cue ${cueIndex} overlaps with a previous cue`,
        cueIndex,
        line: blockStartLine + 1,
      });
      lineOffset += lines.length + 1;
      continue;
    }

    cues.push({
      index: cueIndex,
      startMs,
      endMs,
      text,
    });

    previousEndMs = endMs;
    lineOffset += lines.length + 1;
  }

  for (let i = 1; i < cues.length; i += 1) {
    if (cues[i].startMs < cues[i - 1].endMs) {
      errors.push({
        code: "overlap",
        message: `Cue ${cues[i].index} overlaps with cue ${cues[i - 1].index}`,
        cueIndex: cues[i].index,
      });
    }
  }

  for (let i = 1; i < cues.length; i += 1) {
    if (cues[i].startMs < cues[i - 1].startMs) {
      errors.push({
        code: "invalid_order",
        message: `Cue ${cues[i].index} is out of chronological order`,
        cueIndex: cues[i].index,
      });
    }
  }

  return { cues, warnings, errors };
}

export function isValidSrt(result: SrtParseResult): boolean {
  return result.errors.length === 0 && result.cues.length > 0;
}
