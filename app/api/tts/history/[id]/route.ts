import { getPayload } from "payload";
import { z } from "zod";
import configPromise from "@payload-config";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function parseParams(ctx: RouteContext) {
  const params = await ctx.params;
  return paramsSchema.safeParse(params);
}

async function findGenerationById(
  req: Request,
  id: number,
  includeAudio: boolean,
) {
  const payload = await getPayload({ config: configPromise });
  const { user } = await payload.auth({ headers: req.headers });

  if (!user || user.collection !== "users") {
    return { payload, user: null, generation: null };
  }

  const result = await payload.find({
    collection: "tts-generations",
    where: {
      id: {
        equals: id,
      },
    },
    limit: 1,
    user,
    depth: includeAudio ? 1 : 0,
    select: includeAudio
      ? {
          user: true,
          voice: true,
          voiceSource: true,
          sourceVoiceId: true,
          voiceName: true,
          voiceLocale: true,
          voiceEngine: true,
          title: true,
          inputText: true,
          audio: true,
          audioMime: true,
          audioByteLength: true,
          charCount: true,
          createdAt: true,
          kind: true,
          srtFilename: true,
          cuesTotal: true,
          timelineDurationMs: true,
        }
      : {
          user: true,
          voice: true,
          title: true,
          createdAt: true,
        },
  });

  return {
    payload,
    user,
    generation: result.docs[0] ?? null,
  };
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const parsedParams = await parseParams(ctx);

    if (!parsedParams.success) {
      return Response.json(
        {
          message: "Invalid generation id",
          errors: parsedParams.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { user, generation } = await findGenerationById(
      req,
      parsedParams.data.id,
      true,
    );

    if (!user) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!generation) {
      return Response.json(
        { message: "Generation not found" },
        { status: 404 },
      );
    }

    const audioURL =
      generation.audio &&
      typeof generation.audio === "object" &&
      "url" in generation.audio &&
      typeof generation.audio.url === "string" &&
      generation.audio.url.length > 0
        ? generation.audio.url
        : null;

    return Response.json(
      {
        generation: {
          id: generation.id,
          title: generation.title,
          inputText: generation.inputText,
          voiceSource: generation.voiceSource,
          sourceVoiceId: generation.sourceVoiceId,
          voiceName: generation.voiceName,
          voiceLocale: generation.voiceLocale,
          voiceEngine: generation.voiceEngine,
          audioMime: generation.audioMime,
          audioUrl: audioURL,
          audioByteLength: generation.audioByteLength,
          charCount: generation.charCount,
          createdAt: generation.createdAt,
          kind: generation.kind,
          srtFilename: generation.srtFilename,
          cuesTotal: generation.cuesTotal,
          timelineDurationMs: generation.timelineDurationMs,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("TTS History GET by id Error:", error);
    return Response.json(
      { message: "Unable to load generation" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const parsedParams = await parseParams(ctx);

    if (!parsedParams.success) {
      return Response.json(
        {
          message: "Invalid generation id",
          errors: parsedParams.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { payload, user, generation } = await findGenerationById(
      req,
      parsedParams.data.id,
      false,
    );

    if (!user) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!generation) {
      return Response.json(
        { message: "Generation not found" },
        { status: 404 },
      );
    }

    await payload.delete({
      collection: "tts-generations",
      id: parsedParams.data.id,
      user,
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("TTS History DELETE Error:", error);
    return Response.json(
      { message: "Unable to delete generation" },
      { status: 500 },
    );
  }
}
