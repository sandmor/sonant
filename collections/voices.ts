import type { CollectionConfig } from "payload";

import { syncPollyVoices } from "@/lib/polly/sync-voices";

import { isAdmin, isAuthenticated } from "./access";
import { isAdminUser } from "./access";

export const Voices: CollectionConfig = {
  slug: "voices",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "sourceRecord", "isActive", "isDefault"],
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
      async ({ data, req }) => {
        if (!data || typeof data !== "object") {
          return data;
        }

        // Auto-populate name if it is not provided
        if (!data.name && data.sourceRecord) {
          const relation = data.sourceRecord as { relationTo: string; value: string | number };
          if (relation && relation.relationTo && relation.value) {
            const relatedDoc = await req.payload.findByID({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              collection: relation.relationTo as any,
              id: relation.value,
              depth: 0,
            });
            if (relatedDoc && relatedDoc.name) {
              return {
                ...data,
                name: relatedDoc.name,
              };
            }
          }
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (!doc.isDefault || !doc.sourceRecord?.relationTo) {
          return;
        }

        const relationTo = doc.sourceRecord.relationTo;

        while (true) {
          // We must manually filter since querying polymorphic relations might have limits
          const othersMarkedDefaultRaw = await req.payload.find({
            collection: "voices",
            where: {
              and: [
                {
                  id: {
                    not_equals: doc.id,
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

          // Filter manually
          const othersMarkedDefault = othersMarkedDefaultRaw.docs.filter(
            (v) => v.sourceRecord?.relationTo === relationTo
          );

          if (othersMarkedDefault.length === 0) {
            break;
          }

          await Promise.all(
            othersMarkedDefault.map((voice) =>
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
      required: false,
      maxLength: 120,
      admin: {
        description: "Display name for this voice. Leave empty to auto-fill from the source record.",
      },
    },
    {
      name: "sourceRecord",
      type: "relationship",
      relationTo: ["polly-voices", "qwen-voices"],
      required: true,
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
