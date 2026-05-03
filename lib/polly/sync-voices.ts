import {
  DescribeVoicesCommand,
  PollyClient,
  type Voice as PollyVoice,
} from "@aws-sdk/client-polly";
import type { Payload } from "payload";

const DEFAULT_POLLY_VOICE_ID = process.env.DEFAULT_POLLY_VOICE_ID || "Joanna";

export type SyncPollyVoicesResult = {
  remote: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: boolean;
  error?: string;
};

type VoiceEngineValue =
  | "standard"
  | "neural"
  | "long-form"
  | "generative"
  | "other";

const pollyClient = new PollyClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

function normalizePollyGender(value?: string): "female" | "male" | "unknown" {
  const lower = value?.toLowerCase();

  if (lower === "female") {
    return "female";
  }

  if (lower === "male") {
    return "male";
  }

  return "unknown";
}

function normalizePollyEngines(
  values: string[] | undefined,
): VoiceEngineValue[] {
  if (!values || values.length === 0) {
    return ["standard"];
  }

  const normalized = values
    .map((value) => value.toLowerCase())
    .map((value): VoiceEngineValue => {
      if (
        value === "standard" ||
        value === "neural" ||
        value === "long-form" ||
        value === "generative"
      ) {
        return value;
      }

      return "other";
    });

  return Array.from(new Set(normalized));
}

function sameStringArray(a: string[] | undefined, b: string[] | undefined) {
  if (!a && !b) {
    return true;
  }

  if (!a || !b || a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

async function fetchAllPollyVoices() {
  const allVoices: PollyVoice[] = [];
  let nextToken: string | undefined;

  do {
    const command = new DescribeVoicesCommand(
      nextToken ? { NextToken: nextToken } : {},
    );
    const response = await pollyClient.send(command);

    if (response.Voices?.length) {
      allVoices.push(...response.Voices);
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return allVoices;
}

export async function syncPollyVoices(
  payload: Payload,
  options?: {
    force?: boolean;
  },
): Promise<SyncPollyVoicesResult> {
  try {
    if (!options?.force) {
      const existingVoice = await payload.find({
        collection: "polly-voices",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      if (existingVoice.totalDocs > 0) {
        return {
          remote: 0,
          created: 0,
          updated: 0,
          deactivated: 0,
          skipped: true,
        };
      }
    }

    const remoteVoices = await fetchAllPollyVoices();

    if (remoteVoices.length === 0) {
      payload.logger.warn("No AWS Polly voices were returned during sync");
      return {
        remote: 0,
        created: 0,
        updated: 0,
        deactivated: 0,
        skipped: false,
      };
    }

    const existingPollyVoices = await payload.find({
      collection: "polly-voices",
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    });

    const existingByProviderId = new Map(
      existingPollyVoices.docs
        .filter((doc) => typeof doc.voiceId === "string")
        .map((doc) => [doc.voiceId, doc]),
    );

    const activeAgnosticVoices = await payload.find({
      collection: "voices",
      where: {
        "sourceRecord.relationTo": {
          equals: "polly-voices",
        },
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    });

    // Map polly-voice ID to agnostic voice ID
    const agnosticVoiceMap = new Map(
      activeAgnosticVoices.docs
        .filter((doc) => doc.sourceRecord?.value)
        .map((doc) => [
          typeof doc.sourceRecord?.value === "object"
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (doc.sourceRecord.value as any).id
            : doc.sourceRecord?.value,
          doc,
        ]),
    );

    const remoteVoiceIds = new Set<string>();

    let createdCount = 0;
    let updatedCount = 0;
    let deactivatedCount = 0;

    for (const remoteVoice of remoteVoices) {
      const sourceVoiceId = remoteVoice.Id?.trim();

      if (!sourceVoiceId) {
        continue;
      }

      remoteVoiceIds.add(sourceVoiceId);

      const sourceName = remoteVoice.Name?.trim() || sourceVoiceId;
      const languageCode = remoteVoice.LanguageCode?.trim() || "unknown";
      const languageName = remoteVoice.LanguageName?.trim() || languageCode;
      const normalizedEngines = normalizePollyEngines(
        remoteVoice.SupportedEngines as string[] | undefined,
      );

      const existing = existingByProviderId.get(sourceVoiceId);

      const baseData = {
        voiceId: sourceVoiceId,
        languageCode,
        languageName,
        gender: normalizePollyGender(remoteVoice.Gender),
        engines: normalizedEngines,
      };

      let pollyRecordId: number;

      if (existing) {
        pollyRecordId = existing.id as number;

        const shouldUpdate =
          existing.name !== sourceName ||
          existing.languageCode !== baseData.languageCode ||
          existing.languageName !== baseData.languageName ||
          existing.gender !== baseData.gender ||
          !sameStringArray(
            Array.isArray(existing.engines)
              ? (existing.engines as VoiceEngineValue[])
              : undefined,
            baseData.engines,
          );

        if (shouldUpdate) {
          await payload.update({
            collection: "polly-voices",
            id: existing.id,
            overrideAccess: true,
            data: {
              ...baseData,
              name: sourceName,
            },
          });

          updatedCount += 1;
        }
      } else {
        const newRecord = await payload.create({
          collection: "polly-voices",
          overrideAccess: true,
          data: {
            ...baseData,
            name: sourceName,
          },
        });

        pollyRecordId = newRecord.id as number;
        createdCount += 1;
      }

      // Ensure an agnostic voice record exists
      if (!agnosticVoiceMap.has(pollyRecordId)) {
        await payload.create({
          collection: "voices",
          overrideAccess: true,
          data: {
            name: sourceName,
            sourceRecord: {
              relationTo: "polly-voices",
              value: pollyRecordId,
            },
            isActive: true,
            isDefault: sourceVoiceId === DEFAULT_POLLY_VOICE_ID,
          },
        });
      } else {
        // Ensure it is active
        const existingAgnostic = agnosticVoiceMap.get(pollyRecordId)!;
        if (!existingAgnostic.isActive) {
          await payload.update({
            collection: "voices",
            id: existingAgnostic.id,
            overrideAccess: true,
            data: {
              isActive: true,
            },
          });
        }
      }
    }

    // Deactivate missing remote voices
    for (const existingVoice of existingPollyVoices.docs) {
      const sourceVoiceId = existingVoice.voiceId as string;

      if (remoteVoiceIds.has(sourceVoiceId)) {
        continue;
      }

      // Remote voice removed from Polly. Deactivate associated agnostic voice.
      const agnostic = agnosticVoiceMap.get(existingVoice.id as number);
      if (agnostic && agnostic.isActive) {
        await payload.update({
          collection: "voices",
          id: agnostic.id,
          overrideAccess: true,
          data: {
            isActive: false,
            isDefault: false,
          },
        });
        deactivatedCount += 1;
      }
    }

    // Ensure a default voice exists
    const defaultVoiceRaw = await payload.find({
      collection: "voices",
      where: {
        and: [
          {
            "sourceRecord.relationTo": {
              equals: "polly-voices",
            },
          },
          {
            isDefault: {
              equals: true,
            },
          },
        ],
      },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    if (defaultVoiceRaw.totalDocs === 0) {
      // Find the fallback voice (Joanna) in polly-voices
      const fallbackPollyVoice = await payload.find({
        collection: "polly-voices",
        where: {
          voiceId: {
            equals: DEFAULT_POLLY_VOICE_ID,
          },
        },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      });

      if (fallbackPollyVoice.docs[0]) {
        // Find corresponding agnostic voice
        const agnosticFallback = await payload.find({
          collection: "voices",
          where: {
            "sourceRecord.value": {
              equals: fallbackPollyVoice.docs[0].id,
            },
          },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        });

        if (agnosticFallback.docs[0]) {
          await payload.update({
            collection: "voices",
            id: agnosticFallback.docs[0].id,
            overrideAccess: true,
            data: {
              isDefault: true,
            },
          });
        }
      }
    }

    payload.logger.info(
      `AWS Polly voice sync completed: remote=${remoteVoices.length}, created=${createdCount}, updated=${updatedCount}, deactivated=${deactivatedCount}`,
    );

    return {
      remote: remoteVoices.length,
      created: createdCount,
      updated: updatedCount,
      deactivated: deactivatedCount,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    payload.logger.error(
      `AWS Polly voice sync failed because DescribeVoices failed: ${message}`,
    );

    return {
      remote: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: false,
      error: message,
    };
  }
}
