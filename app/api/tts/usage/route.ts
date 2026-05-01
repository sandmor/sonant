import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  getCurrentWeekStartUTC,
  resolveLimitsFromUser,
} from "@/lib/usage-limits";

export async function GET(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user || user.collection !== "users") {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get user's character limit
    const userDoc = await payload.findByID({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      depth: 1,
      select: {
        tier: true,
      },
    });

    const limits = resolveLimitsFromUser({
      tier: userDoc.tier,
    });

    const characterLimit = limits.weeklyCharacterLimit;
    const maxCharactersPerRequest = limits.maxCharactersPerRequest;

    // Get current week's usage
    const weekStart = getCurrentWeekStartUTC();
    const weekStartISO = weekStart.toISOString();
    const weekKey = `${user.id}:${weekStartISO}`;

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

    const usedCharacters =
      typeof usageResult.docs[0]?.usedCharacters === "number"
        ? usageResult.docs[0].usedCharacters
        : 0;

    const hasWeeklyCharacterLimit = characterLimit > 0;
    const remaining = hasWeeklyCharacterLimit
      ? Math.max(0, characterLimit - usedCharacters)
      : 0;
    const percentage = hasWeeklyCharacterLimit
      ? Math.min(100, (usedCharacters / characterLimit) * 100)
      : 0;

    return Response.json(
      {
        usedCharacters,
        characterLimit,
        maxCharactersPerRequest,
        weekStart: weekStartISO,
        percentage: Math.round(percentage * 10) / 10,
        remaining,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("TTS Usage GET Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
