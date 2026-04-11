export const DEFAULT_WEEKLY_CHARACTER_LIMIT = 100_000;

export type WeeklyUsageLimits = {
  characterLimit: number;
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

export function resolveWeeklyLimitsFromUser(user: {
  weeklyCharacterLimit?: unknown;
}) {
  return {
    characterLimit: normalizeLimitValue(
      user.weeklyCharacterLimit,
      DEFAULT_WEEKLY_CHARACTER_LIMIT,
    ),
  } satisfies WeeklyUsageLimits;
}
