import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { VOICE_SOURCE_VALUES } from "@/lib/voices";

const querySchema = z.object({
  source: z.enum(VOICE_SOURCE_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export async function GET(req: Request) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user || user.collection !== "users") {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsedQuery = querySchema.safeParse({
      source: url.searchParams.get("source") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsedQuery.success) {
      return Response.json(
        {
          message: "Invalid query params",
          errors: parsedQuery.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const sourceFilter = parsedQuery.data.source;
    let targetRelationTo: string | undefined = undefined;
    if (sourceFilter === "aws-polly") targetRelationTo = "polly-voices";
    if (sourceFilter === "qwen") targetRelationTo = "qwen-voices";

    const result = await payload.find({
      collection: "voices",
      where: targetRelationTo
        ? {
            and: [
              {
                isActive: {
                  equals: true,
                },
              },
              {
                "sourceRecord.relationTo": {
                  equals: targetRelationTo,
                },
              },
            ],
          }
        : {
            isActive: {
              equals: true,
            },
          },
      limit: parsedQuery.data.limit,
      user,
      depth: 1, // Need depth 1 to populate sourceRecord
    });

    // Map into unified format
    const docs = result.docs
      .filter(
        (doc) => doc.sourceRecord && typeof doc.sourceRecord.value === "object",
      )
      .map((doc) => {
        const relationTo = doc.sourceRecord.relationTo;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sourceData = doc.sourceRecord.value as any;

        const sourceStr = relationTo === "polly-voices" ? "aws-polly" : "qwen";

        return {
          id: doc.id,
          source: sourceStr,
          sourceVoiceId: sourceData.voiceId,
          name: doc.name || sourceData.name,
          languageCode: sourceData.languageCode,
          languageName: sourceData.languageName,
          gender: sourceData.gender,
          engines: sourceData.engines,
          isDefault: doc.isDefault,
        };
      })
      // Sort in JS instead of DB since DB fields were removed
      .sort((a, b) => {
        const aLang = a.languageCode || "";
        const bLang = b.languageCode || "";
        if (aLang !== bLang) {
          return aLang.localeCompare(bLang);
        }
        return a.name.localeCompare(b.name);
      });

    return Response.json({ docs }, { status: 200 });
  } catch (error) {
    console.error("TTS Voices GET Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
