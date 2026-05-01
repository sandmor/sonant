import type { CollectionConfig, PayloadRequest } from "payload";

import { isAdmin } from "./access";

async function findDefaultTierCount(
  req: PayloadRequest,
  excludeID?: number | string,
) {
  const result =
    excludeID === undefined
      ? await req.payload.find({
          collection: "tiers",
          overrideAccess: true,
          where: {
            isDefault: {
              equals: true,
            },
          },
          limit: 1,
        })
      : await req.payload.find({
          collection: "tiers",
          overrideAccess: true,
          where: {
            and: [
              {
                isDefault: {
                  equals: true,
                },
              },
              {
                id: {
                  not_equals: excludeID,
                },
              },
            ],
          },
          limit: 1,
        });

  return result.totalDocs;
}

export const Tiers: CollectionConfig = {
  slug: "tiers",
  admin: {
    useAsTitle: "name",
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const nextIsDefault =
          typeof data?.isDefault === "boolean"
            ? data.isDefault
            : originalDoc?.isDefault === true;

        if (operation === "create" && nextIsDefault !== true) {
          const defaultTierCount = await findDefaultTierCount(req);

          if (defaultTierCount === 0) {
            return {
              ...data,
              isDefault: true,
            };
          }
        }

        if (
          operation === "update" &&
          originalDoc?.isDefault === true &&
          nextIsDefault !== true
        ) {
          const otherDefaultTierCount = await findDefaultTierCount(
            req,
            originalDoc.id,
          );

          if (otherDefaultTierCount === 0) {
            throw new Error(
              "At least one default tier is required. Set another tier as default before unsetting this one.",
            );
          }
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (!doc.isDefault) {
          return;
        }

        const otherDefaultTiers = await req.payload.find({
          collection: "tiers",
          overrideAccess: true,
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
        });

        await Promise.all(
          otherDefaultTiers.docs.map((tier) =>
            req.payload.update({
              collection: "tiers",
              id: tier.id,
              overrideAccess: true,
              data: {
                isDefault: false,
              },
            }),
          ),
        );
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const tier = await req.payload.findByID({
          collection: "tiers",
          id,
          overrideAccess: true,
          depth: 0,
          select: {
            isDefault: true,
          },
        });

        if (!tier.isDefault) {
          return;
        }

        const otherDefaultTierCount = await findDefaultTierCount(req, id);

        if (otherDefaultTierCount === 0) {
          throw new Error(
            "Cannot delete the last default tier. Set another tier as default first.",
          );
        }
      },
    ],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "weeklyCharacterLimit",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Maximum characters per week. Set to 0 for unlimited.",
      },
    },
    {
      name: "maxCharactersPerRequest",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description:
          "Maximum characters per TTS request. Set to 0 for unlimited.",
      },
    },
    {
      name: "isDefault",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Automatically assign this tier to new users.",
        position: "sidebar",
      },
    },
  ],
};
