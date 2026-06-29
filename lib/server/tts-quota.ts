import type { getPayload } from "payload";

import { getCurrentWeekStartUTC } from "@/lib/usage-limits";

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>;

export type WeeklyUsageRecord = {
  id: number;
  usedCharacters: number;
};

export function getWeekKey(userId: number, now = new Date()) {
  const weekStartISO = getCurrentWeekStartUTC(now).toISOString();
  return {
    weekStartISO,
    weekKey: `${userId}:${weekStartISO}`,
  };
}

export async function findWeeklyUsage(
  payload: PayloadInstance,
  weekKey: string,
): Promise<WeeklyUsageRecord | null> {
  const usageResult = await payload.find({
    collection: "tts-weekly-usage",
    where: {
      weekKey: {
        equals: weekKey,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      usedCharacters: true,
    },
  });

  const usageDoc = usageResult.docs[0];
  if (!usageDoc) {
    return null;
  }

  return {
    id: usageDoc.id,
    usedCharacters:
      typeof usageDoc.usedCharacters === "number" ? usageDoc.usedCharacters : 0,
  };
}

export async function upsertWeeklyUsage(
  payload: PayloadInstance,
  args: {
    userID: number;
    weekStartISO: string;
    weekKey: string;
    usedCharacters: number;
    usageDocID?: number;
  },
) {
  if (args.usageDocID) {
    await payload.update({
      collection: "tts-weekly-usage",
      id: args.usageDocID,
      overrideAccess: true,
      data: {
        usedCharacters: args.usedCharacters,
      },
    });

    return;
  }

  await payload.create({
    collection: "tts-weekly-usage",
    overrideAccess: true,
    data: {
      user: args.userID,
      weekStart: args.weekStartISO,
      weekKey: args.weekKey,
      usedCharacters: args.usedCharacters,
    },
  });
}

export function checkCharacterQuota(args: {
  usedCharacters: number;
  requestedCharacters: number;
  weeklyLimit: number;
  maxPerRequest?: number;
}) {
  const hasWeeklyLimit = args.weeklyLimit > 0;

  if (
    typeof args.maxPerRequest === "number" &&
    args.maxPerRequest > 0 &&
    args.requestedCharacters > args.maxPerRequest
  ) {
    return {
      allowed: false as const,
      reason: "per_request" as const,
    };
  }

  if (
    hasWeeklyLimit &&
    args.usedCharacters + args.requestedCharacters > args.weeklyLimit
  ) {
    return {
      allowed: false as const,
      reason: "weekly" as const,
    };
  }

  return { allowed: true as const };
}
