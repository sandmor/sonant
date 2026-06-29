import { getPayload } from "payload";
import { z } from "zod";
import configPromise from "@payload-config";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  page: z.coerce.number().int().min(1).default(1),
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
      limit: url.searchParams.get("limit") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
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

    const { limit, page } = parsedQuery.data;

    const result = await payload.find({
      collection: "tts-generations",
      where: {
        user: {
          equals: user.id,
        },
      },
      sort: "-createdAt",
      limit,
      page,
      user,
      depth: 0,
      select: {
        user: true,
        voice: true,
        voiceSource: true,
        sourceVoiceId: true,
        voiceName: true,
        voiceLocale: true,
        voiceEngine: true,
        title: true,
        inputText: true,
        charCount: true,
        createdAt: true,
        kind: true,
        srtFilename: true,
        cuesTotal: true,
        timelineDurationMs: true,
      },
    });

    const docs = result.docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      inputText: doc.inputText,
      voiceSource: doc.voiceSource,
      sourceVoiceId: doc.sourceVoiceId,
      voiceName: doc.voiceName,
      voiceLocale: doc.voiceLocale,
      voiceEngine: doc.voiceEngine,
      charCount: doc.charCount,
      createdAt: doc.createdAt,
      kind: doc.kind,
      srtFilename: doc.srtFilename,
      cuesTotal: doc.cuesTotal,
      timelineDurationMs: doc.timelineDurationMs,
    }));

    return Response.json(
      {
        docs,
        totalPages: result.totalPages,
        page: result.page,
        totalDocs: result.totalDocs,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("TTS History GET Error:", error);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
