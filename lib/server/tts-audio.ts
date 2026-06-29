import { randomUUID } from "crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { getPayload } from "payload";

import { getRequiredS3Config } from "@/lib/server/env";

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>;

function createS3Client() {
  const config = getRequiredS3Config();

  return {
    client: new S3Client({
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    bucket: config.bucket,
  };
}

export function resolveStorageObjectKey(args: {
  url?: string | null;
  filename?: string | null;
  prefix?: string | null;
}): string | null {
  const config = getRequiredS3Config();

  if (typeof args.url === "string" && args.url.length > 0) {
    try {
      const { pathname } = new URL(args.url);
      const normalizedPath = decodeURIComponent(pathname.replace(/^\/+/, ""));
      const bucketPrefix = `${config.bucket}/`;

      if (normalizedPath.startsWith(bucketPrefix)) {
        return normalizedPath.slice(bucketPrefix.length);
      }
    } catch {
      // Fall through to filename-based resolution.
    }
  }

  if (typeof args.filename !== "string" || args.filename.length === 0) {
    return null;
  }

  if (typeof args.prefix === "string" && args.prefix.length > 0) {
    const prefix = args.prefix.replace(/^\/+|\/+$/g, "");
    return prefix ? `${prefix}/${args.filename}` : args.filename;
  }

  return args.filename;
}

export async function verifyStoredAudioObject(args: {
  filename: string;
  expectedByteLength?: number;
}) {
  const { client, bucket } = createS3Client();

  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: args.filename,
    }),
  );

  const byteLength =
    typeof head.ContentLength === "number" ? head.ContentLength : 0;

  if (byteLength <= 0) {
    throw new Error(`Stored audio object '${args.filename}' is empty`);
  }

  if (
    typeof args.expectedByteLength === "number" &&
    args.expectedByteLength > 0 &&
    byteLength !== args.expectedByteLength
  ) {
    throw new Error(
      `Stored audio size mismatch for '${args.filename}' (expected ${args.expectedByteLength}, got ${byteLength})`,
    );
  }

  return {
    byteLength,
    mimeType:
      typeof head.ContentType === "string" && head.ContentType.length > 0
        ? head.ContentType
        : "audio/wav",
  };
}

export async function downloadStoredAudioObject(filename: string) {
  const { client, bucket } = createS3Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: filename,
    }),
  );

  if (!response.Body) {
    throw new Error(`Stored audio object '${filename}' has no body`);
  }

  return Buffer.from(await response.Body.transformToByteArray());
}

export async function deleteStoredAudioObject(filename: string) {
  const { client, bucket } = createS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: filename,
    }),
  );
}

export async function registerTtsAudioFromStorage(
  payload: PayloadInstance,
  args: {
    userId: number;
    filename: string;
    filesize: number;
    user?: { id: number; collection?: string };
    deleteSourceAfterRegister?: boolean;
  },
) {
  const verified = await verifyStoredAudioObject({
    filename: args.filename,
    expectedByteLength: args.filesize,
  });

  const audioData = await downloadStoredAudioObject(args.filename);
  const payloadFilename = `tts-${randomUUID()}.wav`;

  const uploadDoc = await payload.create({
    collection: "tts-audio",
    overrideAccess: true,
    data: {
      user: args.userId,
    },
    user: args.user,
    file: {
      data: audioData,
      mimetype: verified.mimeType,
      name: payloadFilename,
      size: verified.byteLength,
    },
  });

  if (args.deleteSourceAfterRegister) {
    await deleteStoredAudioObject(args.filename).catch(() => undefined);
  }

  return uploadDoc;
}
