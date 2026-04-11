export type RequiredS3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

let cachedS3Config: RequiredS3Config | null = null;

export const DEFAULT_TTS_RETENTION_DAYS = 90;

function readRequiredEnvVar(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required S3 configuration: ${name}. Configure all S3_* variables before starting the app.`,
    );
  }

  return value;
}

export function getRequiredS3Config(): RequiredS3Config {
  if (cachedS3Config) {
    return cachedS3Config;
  }

  const config: RequiredS3Config = {
    endpoint: readRequiredEnvVar("S3_ENDPOINT"),
    region: readRequiredEnvVar("S3_REGION"),
    bucket: readRequiredEnvVar("S3_BUCKET"),
    accessKeyId: readRequiredEnvVar("S3_ACCESS_KEY_ID"),
    secretAccessKey: readRequiredEnvVar("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  };

  cachedS3Config = config;
  return config;
}

export function assertRequiredS3Config() {
  getRequiredS3Config();
}

export function getTTSRetentionDays() {
  const rawValue = process.env.TTS_RETENTION_DAYS?.trim();

  if (!rawValue) {
    return DEFAULT_TTS_RETENTION_DAYS;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TTS_RETENTION_DAYS;
  }

  return Math.max(1, Math.floor(parsed));
}
