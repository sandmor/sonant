import type { CollectionConfig } from "payload";
import { isAdminUser } from "./access";

const enforceVerification = process.env.REQUIRE_VERIFICATION === "true";

function canReadOrUpdateUser({
  req,
}: {
  req: { user?: { id?: number | string; collection?: string | null } | null };
}) {
  if (!req.user) {
    return false;
  }

  if (isAdminUser(req.user)) {
    return true;
  }

  if (req.user.collection !== "users") {
    return false;
  }

  return {
    id: {
      equals: req.user.id,
    },
  };
}

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    verify: {
      generateEmailHTML: ({ token, user }) => {
        const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`;
        return `
          <p>Hey ${user.email},</p>
          <p>Thanks for choosing Sonant,</p>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${url}">${url}</a>
        `;
      },
      generateEmailSubject: ({ user }) => {
        return `Verify your account, ${user.email}!`;
      },
    },
    forgotPassword: {
      generateEmailHTML: (args) => {
        const token = args?.token ?? "";
        const userEmail = args?.user?.email ?? "there";
        const url = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
        return `
          <p>Hey ${userEmail},</p>
          <p>We received a request to reset your Sonant password.</p>
          <p>Use the link below to set a new password:</p>
          <a href="${url}">${url}</a>
          <p>If you did not request this, you can safely ignore this email.</p>
        `;
      },
      generateEmailSubject: (args) => {
        const userEmail = args?.user?.email ?? "friend";
        return `Reset your Sonant password, ${userEmail}`;
      },
    },
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === "create" && !enforceVerification) {
          (data as Record<string, unknown>)._verified = true;
        }

        return data;
      },
    ],
  },
  admin: {
    useAsTitle: "email",
  },
  access: {
    create: () => true,
    read: canReadOrUpdateUser,
    update: canReadOrUpdateUser,
    delete: ({ req }) => isAdminUser(req.user),
  },
  fields: [
    {
      name: "tier",
      type: "relationship",
      relationTo: "tiers",
      hasMany: false,
      required: true,
      defaultValue: async ({ req }) => {
        if (!req?.payload) return undefined;

        const defaultTier = await req.payload.find({
          collection: "tiers",
          where: {
            isDefault: {
              equals: true,
            },
          },
          limit: 1,
        });

        return defaultTier.docs[0]?.id;
      },
      hooks: {
        beforeValidate: [
          async ({ value, req, operation }) => {
            if (!value && operation === "create") {
              if (!req?.payload) return value;
              const defaultTier = await req.payload.find({
                collection: "tiers",
                where: {
                  isDefault: {
                    equals: true,
                  },
                },
                limit: 1,
              });

              if (defaultTier.docs.length > 0) {
                return defaultTier.docs[0].id;
              }
            }
            return value;
          },
        ],
      },
      access: {
        create: ({ req }) => isAdminUser(req.user),
        read: ({ req }) => isAdminUser(req.user),
        update: ({ req }) => isAdminUser(req.user),
      },
      admin: {
        condition: (_, __, options) => Boolean(options?.user),
        position: "sidebar",
        description:
          "Tier determines the limits and capabilities of this user.",
      },
    },
  ],
};
