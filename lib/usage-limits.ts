export const DEFAULT_WEEKLY_CHARACTER_LIMIT = 100_000;
export const DEFAULT_MAX_CHARACTERS_PER_REQUEST = 3000;
export const ABSOLUTE_MAX_TTS_REQUEST_CHARACTERS = 1_000_000;

export type UsageLimits = {
  weeklyCharacterLimit: number;
  maxCharactersPerRequest: number;
};

export function getCurrentWeekStartUTC(now = new Date()) {
  const weekStart = new Date(now);
  const weekday = (weekStart.getUTCDay() + 6) % 7;

  weekStart.setUTCDate(weekStart.getUTCDate() - weekday);
  weekStart.setUTCHours(0, 0, 0, 0);

  return weekStart;
}

function normalizeLimitValue(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

export function resolveLimitsFromUser(user: {
  tier?:
    | unknown
    | { weeklyCharacterLimit?: number; maxCharactersPerRequest?: number };
}) {
  let weekly = DEFAULT_WEEKLY_CHARACTER_LIMIT;
  let request = DEFAULT_MAX_CHARACTERS_PER_REQUEST;

  if (user && typeof user.tier === "object" && user.tier !== null) {
    const tier = user.tier as {
      weeklyCharacterLimit?: number;
      maxCharactersPerRequest?: number;
    };
    if (typeof tier.weeklyCharacterLimit === "number") {
      weekly = tier.weeklyCharacterLimit;
    }
    if (typeof tier.maxCharactersPerRequest === "number") {
      request = tier.maxCharactersPerRequest;
    }
  }

  return {
    weeklyCharacterLimit: normalizeLimitValue(
      weekly,
      DEFAULT_WEEKLY_CHARACTER_LIMIT,
    ),
    maxCharactersPerRequest: normalizeLimitValue(
      request,
      DEFAULT_MAX_CHARACTERS_PER_REQUEST,
    ),
  } satisfies UsageLimits;
}
