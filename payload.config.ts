import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import path from "path";
import { fileURLToPath } from "url";
import { resendAdapter } from "@payloadcms/email-resend";

import { Admins } from "./collections/admins";
import { Users } from "./collections/users";
import { Voices } from "./collections/voices";
import { PollyVoices } from "./collections/polly-voices";
import { QwenVoices } from "./collections/qwen-voices";
import { TTSAudio } from "./collections/tts-audio";
import { TTSGenerations } from "./collections/tts-generations";
import { TTSWeeklyUsage } from "./collections/tts-weekly-usage";
import { Tiers } from "./collections/tiers";
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
      defaultFromName: "Sonant",
      apiKey: process.env.RESEND_API_KEY,
    })
  : undefined;

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  serverURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  admin: {
    user: "admins",
  },
  editor: lexicalEditor({}),
  graphQL: {
    disable: true,
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
    migrationDir: path.resolve(dirname, "migrations"),
  }),
  email: emailAdapter,
  collections: [
    Admins,
    Users,
    Voices,
    PollyVoices,
    QwenVoices,
    TTSAudio,
    TTSGenerations,
    TTSWeeklyUsage,
    Tiers,
  ],
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
    const defaultTiers = await payload.find({
      collection: "tiers",
      where: {
        isDefault: {
          equals: true,
        },
      },
      limit: 1,
    });

    if (defaultTiers.totalDocs === 0) {
      await payload.create({
        collection: "tiers",
        data: {
          name: "Basic Tier",
          weeklyCharacterLimit: 15000,
          maxCharactersPerRequest: 3000,
          isDefault: true,
        },
      });
      payload.logger.info("Seeded default Tier.");
    }

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
