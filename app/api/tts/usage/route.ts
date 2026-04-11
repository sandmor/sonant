import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  getCurrentWeekStartUTC,
  resolveWeeklyLimitsFromUser,
} from "@/lib/usage-limits";

export async function GET(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get user's character limit
    const userDoc = await payload.findByID({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      depth: 0,
      select: {
        weeklyCharacterLimit: true,
      },
    });

    const { characterLimit } = resolveWeeklyLimitsFromUser({
      weeklyCharacterLimit: userDoc.weeklyCharacterLimit,
    });

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

    const remaining = Math.max(0, characterLimit - usedCharacters);
    const percentage =
      characterLimit > 0
        ? Math.min(100, (usedCharacters / characterLimit) * 100)
        : 0;

    return Response.json(
      {
        usedCharacters,
        characterLimit,
        weekStart: weekStartISO,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
        remaining,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("TTS Usage GET Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
