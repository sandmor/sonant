import type { Access, CollectionConfig } from "payload";

import { VOICE_SOURCE_VALUES } from "@/lib/voices";
import { ABSOLUTE_MAX_TTS_REQUEST_CHARACTERS } from "@/lib/usage-limits";

import { isAdmin, isAdminUser } from "./access";

const voiceEngineOptions = [
  { label: "Standard", value: "standard" },
  { label: "Neural", value: "neural" },
  { label: "Long-form", value: "long-form" },
  { label: "Generative", value: "generative" },
  { label: "Other", value: "other" },
];

const voiceSourceOptions = VOICE_SOURCE_VALUES.map((value) => ({
  label: value,
  value,
}));

const isOwnerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) {
    return false;
  }

  if (isAdminUser(user)) {
    return true;
  }

  return {
    user: {
      equals: user.id,
    },
  };
};

export const TTSGenerations: CollectionConfig = {
  slug: "tts-generations",
  admin: {
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "voiceName",
      "voiceSource",
      "charCount",
      "createdAt",
    ],
  },
  access: {
    // Create must only happen through the dedicated TTS API route.
    create: () => false,
    read: isOwnerOrAdmin,
    update: isAdmin,
    delete: isOwnerOrAdmin,
  },
  hooks: {
    beforeChange: [
      ({ req, data, operation, originalDoc }) => {
        if (!req.user) {
          return data;
        }

        const inputText =
          typeof data?.inputText === "string"
            ? data.inputText.trim()
            : undefined;
        const nextInputText =
          inputText ??
          (typeof originalDoc?.inputText === "string"
            ? originalDoc.inputText
            : undefined);
        const title =
          typeof data?.title === "string" ? data.title.trim() : undefined;
        const nextTitle = title?.length
          ? title
          : nextInputText
            ? nextInputText.slice(0, 72)
            : typeof originalDoc?.title === "string"
              ? originalDoc.title
              : title;

        return {
          ...data,
          inputText: nextInputText,
          title: nextTitle,
          charCount:
            typeof nextInputText === "string"
              ? nextInputText.length
              : originalDoc?.charCount,
          user: operation === "create" ? req.user.id : originalDoc?.user,
        };
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (typeof doc.audio !== "number") {
          req.payload.logger.error(
            `Generation ${doc.id} has invalid audio relationship value`,
          );
          return;
        }

        try {
          await req.payload.delete({
            collection: "tts-audio",
            id: doc.audio,
            overrideAccess: true,
          });
        } catch (error) {
          req.payload.logger.error(
            `Failed to delete audio upload '${doc.audio}' for generation ${doc.id}: ${String(error)}`,
          );
        }
      },
    ],
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "voice",
      type: "relationship",
      relationTo: "voices",
      required: true,
    },
    {
      name: "voiceSource",
      type: "select",
      required: true,
      options: voiceSourceOptions,
    },
    {
      name: "sourceVoiceId",
      label: "Provider Voice ID",
      type: "text",
      required: true,
      maxLength: 160,
    },
    {
      name: "voiceName",
      type: "text",
      required: true,
    },
    {
      name: "voiceLocale",
      type: "text",
      required: true,
    },
    {
      name: "voiceEngine",
      type: "select",
      required: true,
      options: voiceEngineOptions,
    },
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 140,
    },
    {
      name: "inputText",
      type: "textarea",
      required: true,
      maxLength: ABSOLUTE_MAX_TTS_REQUEST_CHARACTERS,
    },
    {
      name: "audio",
      type: "relationship",
      relationTo: "tts-audio",
      required: true,
    },
    {
      name: "audioMime",
      type: "text",
      required: true,
      defaultValue: "audio/mpeg",
    },
    {
      name: "audioByteLength",
      type: "number",
      required: true,
      min: 1,
    },
    {
      name: "charCount",
      type: "number",
      required: true,
      min: 1,
    },
  ],
};
