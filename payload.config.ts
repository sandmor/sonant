import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import path from "path";
import { fileURLToPath } from "url";
import { resendAdapter } from "@payloadcms/email-resend";

import { Users } from "./collections/users";
import { Voices } from "./collections/voices";
import { TTSAudio } from "./collections/tts-audio";
import { TTSGenerations } from "./collections/tts-generations";
import { TTSWeeklyUsage } from "./collections/tts-weekly-usage";
import { syncPollyVoices } from "./lib/polly/sync-voices";
import { runTTSSoftRetentionCleanupIfDue } from "./lib/retention/tts-retention";
import { getRequiredS3Config } from "./lib/server/env";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const s3Config = getRequiredS3Config();

const emailAdapter = process.env.RESEND_API_KEY
  ? resendAdapter({
      defaultFromAddress:
        process.env.RESEND_FROM_EMAIL || "noreply@example.com",
      defaultFromName: "My App",
      apiKey: process.env.RESEND_API_KEY,
    })
  : undefined;

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  admin: {
    user: "users",
  },
  editor: lexicalEditor({}),
  graphQL: {
    disable: true,
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
  }),
  email: emailAdapter,
  collections: [Users, Voices, TTSAudio, TTSGenerations, TTSWeeklyUsage],
  plugins: [
    s3Storage({
      collections: {
        "tts-audio": {
          signedDownloads: {
            expiresIn: 60 * 60,
          },
        },
      },
      bucket: s3Config.bucket,
      config: {
        endpoint: s3Config.endpoint,
        forcePathStyle: s3Config.forcePathStyle,
        region: s3Config.region,
        credentials: {
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
        },
      },
    }),
  ],
  onInit: async (payload) => {
    const result = await syncPollyVoices(payload);

    if (result.error) {
      payload.logger.error(`AWS Polly sync failed on init: ${result.error}`);
    }

    const retentionResult = await runTTSSoftRetentionCleanupIfDue(payload);
    if (retentionResult) {
      payload.logger.info(
        `TTS soft retention cleanup completed: deleted=${retentionResult.deletedGenerations}, cutoff=${retentionResult.cutoffISO}`,
      );
    }
  },
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
