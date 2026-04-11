import type { CollectionConfig } from "payload";

import { syncPollyVoices } from "@/lib/polly/sync-voices";

import { isAdmin, isAuthenticated } from "./access";
import { isAdminUser } from "./access";

const sourceOptions = [
  { label: "AWS Polly", value: "aws-polly" },
  { label: "Other", value: "other" },
];

const genderOptions = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "Neutral", value: "neutral" },
  { label: "Unknown", value: "unknown" },
];

const engineOptions = [
  { label: "Standard", value: "standard" },
  { label: "Neural", value: "neural" },
  { label: "Long-form", value: "long-form" },
  { label: "Generative", value: "generative" },
  { label: "Other", value: "other" },
];

export const Voices: CollectionConfig = {
  slug: "voices",
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "source",
      "sourceVoiceId",
      "languageCode",
      "gender",
      "isActive",
      "isDefault",
    ],
    components: {
      beforeList: [
        "@/components/payload/sync-voices-control#SyncVoicesControl",
      ],
    },
  },
  access: {
    read: isAuthenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== "object") {
          return data;
        }

        const source =
          typeof data.source === "string" ? data.source.trim() : undefined;
        const sourceVoiceId =
          typeof data.sourceVoiceId === "string"
            ? data.sourceVoiceId.trim()
            : undefined;

        if (!source || !sourceVoiceId) {
          return data;
        }

        return {
          ...data,
          sourceKey: `${source}:${sourceVoiceId}`,
        };
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (!doc.isDefault || typeof doc.source !== "string") {
          return;
        }

        while (true) {
          const othersMarkedDefault = await req.payload.find({
            collection: "voices",
            where: {
              and: [
                {
                  id: {
                    not_equals: doc.id,
                  },
                },
                {
                  source: {
                    equals: doc.source,
                  },
                },
                {
                  isDefault: {
                    equals: true,
                  },
                },
              ],
            },
            limit: 200,
            depth: 0,
            overrideAccess: true,
          });

          if (othersMarkedDefault.docs.length === 0) {
            break;
          }

          await Promise.all(
            othersMarkedDefault.docs.map((voice) =>
              req.payload.update({
                collection: "voices",
                id: voice.id,
                overrideAccess: true,
                data: {
                  isDefault: false,
                },
              }),
            ),
          );
        }
      },
    ],
  },
  endpoints: [
    {
      path: "/sync",
      method: "post",
      handler: async (req) => {
        if (!isAdminUser(req.user)) {
          return Response.json({ message: "Forbidden" }, { status: 403 });
        }

        const result = await syncPollyVoices(req.payload, { force: true });

        if (result.error) {
          return Response.json(
            {
              message: "Voice sync failed",
              error: result.error,
              result,
            },
            { status: 502 },
          );
        }

        return Response.json(
          {
            ok: true,
            result,
          },
          { status: 200 },
        );
      },
    },
  ],
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "aws-polly",
      options: sourceOptions,
    },
    {
      name: "sourceVoiceId",
      label: "Provider Voice ID",
      type: "text",
      required: true,
      maxLength: 160,
    },
    {
      name: "sourceKey",
      type: "text",
      required: true,
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: "sourceName",
      label: "Provider Name",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "languageCode",
      type: "text",
      required: true,
      maxLength: 16,
    },
    {
      name: "languageName",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "gender",
      type: "select",
      required: true,
      defaultValue: "unknown",
      options: genderOptions,
    },
    {
      name: "engines",
      type: "select",
      hasMany: true,
      options: engineOptions,
      defaultValue: ["standard"],
    },
    {
      name: "isActive",
      type: "checkbox",
      required: true,
      defaultValue: true,
    },
    {
      name: "isDefault",
      type: "checkbox",
      required: true,
      defaultValue: false,
    },
    {
      name: "metadata",
      type: "json",
    },
  ],
};
