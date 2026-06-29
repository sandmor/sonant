import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { getRequiredS3Config } from "@/lib/server/env";
import { resolveStorageObjectKey } from "@/lib/server/tts-audio";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function sanitizeFileStem(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "audio";
}

function getExtension(filename: string | null, mimeType: string | null) {
  if (filename) {
    const parts = filename.split(".");
    if (parts.length > 1) {
      const extension = parts.at(-1)?.toLowerCase();
      if (extension) {
        return extension;
      }
    }
  }

  if (mimeType?.includes("wav")) {
    return "wav";
  }

  if (mimeType?.includes("ogg")) {
    return "ogg";
  }

  if (mimeType?.includes("webm")) {
    return "webm";
  }

  return "mp3";
}

const s3Config = getRequiredS3Config();
const s3Client = new S3Client({
  endpoint: s3Config.endpoint,
  forcePathStyle: s3Config.forcePathStyle,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
});

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const params = await ctx.params;
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return Response.json(
        {
          message: "Invalid generation id",
          errors: parsedParams.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user || user.collection !== "users") {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await payload.find({
      collection: "tts-generations",
      where: {
        id: {
          equals: parsedParams.data.id,
        },
      },
      limit: 1,
      depth: 1,
      user,
      select: {
        title: true,
        audio: true,
        audioMime: true,
      },
    });

    const generation = result.docs[0] ?? null;

    if (!generation) {
      return Response.json(
        { message: "Generation not found" },
        { status: 404 },
      );
    }

    const audio =
      generation.audio && typeof generation.audio === "object"
        ? generation.audio
        : null;
    const audioUrl =
      audio && typeof audio.url === "string" && audio.url.length > 0
        ? audio.url
        : null;
    const audioPrefix =
      audio &&
      "prefix" in audio &&
      typeof audio.prefix === "string"
        ? audio.prefix
        : null;

    const mimeType =
      (audio && typeof audio.mimeType === "string" ? audio.mimeType : null) ||
      generation.audioMime ||
      "audio/mpeg";
    const sourceFilename =
      audio && typeof audio.filename === "string" ? audio.filename : null;

    if (!sourceFilename) {
      return Response.json(
        { message: "Audio file not available" },
        { status: 404 },
      );
    }

    const extension = getExtension(sourceFilename, mimeType);
    const objectKey = resolveStorageObjectKey({
      url: audioUrl,
      filename: sourceFilename,
      prefix: audioPrefix,
    });

    if (!objectKey) {
      return Response.json(
        { message: "Audio file not available" },
        { status: 404 },
      );
    }

    const filename = `${sanitizeFileStem(generation.title)}.${extension}`;
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
        ResponseContentType: mimeType,
      }),
      {
        expiresIn: 60,
      },
    );

    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("TTS History download Error:", error);
    return Response.json(
      { message: "Unable to download generation" },
      { status: 500 },
    );
  }
}
