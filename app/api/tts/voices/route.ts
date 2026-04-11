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

    if (!user) {
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

    const source = parsedQuery.data.source;

    const result = await payload.find({
      collection: "voices",
      where: source
        ? {
            and: [
              {
                isActive: {
                  equals: true,
                },
              },
              {
                source: {
                  equals: source,
                },
              },
            ],
          }
        : {
            isActive: {
              equals: true,
            },
          },
      sort: "languageCode",
      limit: parsedQuery.data.limit,
      user,
      depth: 0,
    });

    const docs = result.docs.map((doc) => ({
      id: doc.id,
      source: doc.source,
      sourceVoiceId: doc.sourceVoiceId,
      name: doc.name,
      languageCode: doc.languageCode,
      languageName: doc.languageName,
      gender: doc.gender,
      engines: doc.engines,
      isDefault: doc.isDefault,
    }));

    return Response.json({ docs }, { status: 200 });
  } catch (error) {
    console.error("TTS Voices GET Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
