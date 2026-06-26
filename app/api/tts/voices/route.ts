import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import {
  isModalEngineSource,
  modalVoiceSupportsSource,
  relationToForSource,
  VOICE_SOURCE_VALUES,
  type ModalEngineSource,
  type VoiceSource,
} from "@/lib/voices";

const querySchema = z.object({
  source: z.enum(VOICE_SOURCE_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

type MappedVoice = {
  id: number;
  source: VoiceSource;
  supportedEngines: string[];
  sourceVoiceId: string;
  name: string;
  languageCode?: string;
  languageName?: string;
  defaultLanguage?: string | null;
  gender: string;
  engines?: string[];
  isDefault: boolean;
};

type CatalogVoiceDoc = {
  id: number;
  name?: string | null;
  isDefault: boolean;
};

function mapPollyVoice(
  doc: CatalogVoiceDoc,
  sourceData: Record<string, unknown>,
): MappedVoice {
  return {
    id: doc.id,
    source: "aws-polly",
    supportedEngines: [],
    sourceVoiceId: String(sourceData.voiceId),
    name: doc.name || String(sourceData.name),
    languageCode:
      typeof sourceData.languageCode === "string"
        ? sourceData.languageCode
        : undefined,
    languageName:
      typeof sourceData.languageName === "string"
        ? sourceData.languageName
        : undefined,
    defaultLanguage: null,
    gender: String(sourceData.gender),
    engines: Array.isArray(sourceData.engines)
      ? sourceData.engines.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    isDefault: doc.isDefault,
  };
}

function mapModalVoice(
  doc: CatalogVoiceDoc,
  sourceData: Record<string, unknown>,
  source: ModalEngineSource,
  supportedEngines: string[],
): MappedVoice {
  return {
    id: doc.id,
    source,
    supportedEngines,
    sourceVoiceId: String(sourceData.voiceId),
    name: doc.name || String(sourceData.name),
    defaultLanguage:
      typeof sourceData.defaultLanguage === "string"
        ? sourceData.defaultLanguage
        : null,
    gender: String(sourceData.gender),
    isDefault: doc.isDefault,
  };
}

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
    const targetRelationTo = sourceFilter
      ? relationToForSource(sourceFilter)
      : null;

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
      depth: 1,
    });

    const docs = result.docs
      .filter(
        (doc) => doc.sourceRecord && typeof doc.sourceRecord.value === "object",
      )
      .flatMap((doc) => {
        const relationTo = doc.sourceRecord.relationTo;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sourceData = doc.sourceRecord.value as any;

        if (relationTo === "polly-voices") {
          if (sourceFilter && sourceFilter !== "aws-polly") {
            return [];
          }

          return [mapPollyVoice(doc, sourceData)];
        }

        if (relationTo !== "modal-voices") {
          return [];
        }

        const supportedEngines = (Array.isArray(sourceData.engines)
          ? sourceData.engines
          : []
        ).filter(
          (entry: unknown): entry is ModalEngineSource =>
            typeof entry === "string" && isModalEngineSource(entry),
        );

        if (supportedEngines.length === 0) {
          return [];
        }

        if (sourceFilter && isModalEngineSource(sourceFilter)) {
          if (!modalVoiceSupportsSource(supportedEngines, sourceFilter)) {
            return [];
          }

          return [
            mapModalVoice(doc, sourceData, sourceFilter, supportedEngines),
          ];
        }

        return supportedEngines.map((source: ModalEngineSource) =>
          mapModalVoice(doc, sourceData, source, supportedEngines),
        );
      })
      .sort((a, b) => {
        const aLang = a.languageCode || a.name;
        const bLang = b.languageCode || b.name;
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
