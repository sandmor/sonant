import type { getPayload } from "payload";

import {
  isModalEngineSource,
  modalVoiceSupportsSource,
  relationToForSource,
  type VoiceSource,
} from "@/lib/voices";

export type VoiceRecord = {
  id: number;
  source: VoiceSource;
  sourceVoiceId: string;
  name: string;
  languageCode?: string;
  pollyMetadata?: {
    engines?: unknown;
  };
  isActive: boolean;
};

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>;
type AuthUser = NonNullable<
  Awaited<ReturnType<PayloadInstance["auth"]>>["user"]
>;

export async function resolveVoice(
  payload: PayloadInstance,
  user: AuthUser,
  source: VoiceSource,
  sourceVoiceId?: string,
): Promise<VoiceRecord | null> {
  const targetRelationTo = relationToForSource(source);

  if (!targetRelationTo) return null;

  const modalEngineFilter = isModalEngineSource(source) ? source : null;

  if (sourceVoiceId) {
    const providerWhere =
      targetRelationTo === "modal-voices" && modalEngineFilter
        ? {
            and: [
              { voiceId: { equals: sourceVoiceId } },
              { engines: { contains: modalEngineFilter } },
            ],
          }
        : {
            voiceId: { equals: sourceVoiceId },
          };

    const providerDocs = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: targetRelationTo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: providerWhere as any,
      limit: 1,
      depth: 0,
      user,
    });

    if (providerDocs.docs.length === 0) return null;
    const providerDoc = providerDocs.docs[0];

    const matchedVoice = await payload.find({
      collection: "voices",
      where: {
        and: [
          { "sourceRecord.relationTo": { equals: targetRelationTo } },
          { "sourceRecord.value": { equals: providerDoc.id } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      depth: 1,
      user,
    });

    if (matchedVoice.docs.length > 0) {
      const agnostic = matchedVoice.docs[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceData = agnostic.sourceRecord?.value as any;
      if (sourceData) {
        return {
          id: agnostic.id,
          source,
          sourceVoiceId: sourceData.voiceId,
          name: agnostic.name || sourceData.name,
          languageCode: sourceData.languageCode,
          pollyMetadata: { engines: sourceData.engines },
          isActive: true,
        };
      }
    }
  }

  const defaultWhere = {
    and: [
      { "sourceRecord.relationTo": { equals: targetRelationTo } },
      { isActive: { equals: true } },
      { isDefault: { equals: true } },
    ],
  };

  const preferredDefault = await payload.find({
    collection: "voices",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: defaultWhere as any,
    limit: 50,
    depth: 1,
    user,
  });

  const defaultDoc =
    targetRelationTo === "modal-voices" && modalEngineFilter
      ? preferredDefault.docs.find((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sourceData = doc.sourceRecord?.value as any;
          return modalVoiceSupportsSource(sourceData?.engines, modalEngineFilter);
        })
      : preferredDefault.docs[0];

  if (defaultDoc) {
    const agnostic = defaultDoc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceData = agnostic.sourceRecord?.value as any;
    if (sourceData) {
      return {
        id: agnostic.id,
        source,
        sourceVoiceId: sourceData.voiceId,
        name: agnostic.name || sourceData.name,
        languageCode: sourceData.languageCode,
        pollyMetadata: { engines: sourceData.engines },
        isActive: true,
      };
    }
  }

  return null;
}
