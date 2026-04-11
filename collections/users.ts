import type { CollectionConfig } from "payload";
import type { Where } from "payload";
import { z } from "zod";

import { DEFAULT_WEEKLY_CHARACTER_LIMIT } from "@/lib/usage-limits";

import { isAdminUser } from "./access";

const enforceVerification = process.env.REQUIRE_VERIFICATION === "true";

const isAdminAccess = ({
  req,
}: {
  req: { user?: { email?: string | null; role?: string | null } | null };
}) => isAdminUser(req.user);

const bulkLimitsSchema = z
  .object({
    weeklyCharacterLimit: z.number().int().min(0).optional(),
    includeAdmins: z.boolean().optional().default(false),
  })
  .refine((value) => value.weeklyCharacterLimit !== undefined, {
    message: "Provide a character limit to update",
    path: ["weeklyCharacterLimit"],
  });

function buildUpdateScopeWhere(args: {
  includeAdmins: boolean;
  adminEmail?: string;
}): Where {
  if (args.includeAdmins) {
    return {};
  }

  const andConditions: Where["and"] = [
    {
      role: {
        not_equals: "admin",
      },
    },
  ];

  if (args.adminEmail) {
    andConditions.push({
      email: {
        not_equals: args.adminEmail,
      },
    });
  }

  return {
    and: andConditions,
  };
}

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    verify: enforceVerification
      ? {
          generateEmailHTML: ({ req, token, user }) => {
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
        }
      : false,
  },
  admin: {
    useAsTitle: "email",
    components: {
      beforeList: [
        "@/components/payload/bulk-user-limits-control#BulkUserLimitsControl",
      ],
    },
  },
  access: {
    create: () => true,
    admin: isAdminAccess,
  },
  endpoints: [
    {
      path: "/bulk-limits",
      method: "post",
      handler: async (req) => {
        if (!isAdminUser(req.user)) {
          return Response.json({ message: "Forbidden" }, { status: 403 });
        }

        let body: unknown;
        try {
          if (typeof req.json !== "function") {
            return Response.json(
              { message: "Request body is required" },
              { status: 400 },
            );
          }

          body = await req.json();
        } catch {
          return Response.json(
            { message: "Invalid JSON body" },
            { status: 400 },
          );
        }

        const parsed = bulkLimitsSchema.safeParse(body);

        if (!parsed.success) {
          return Response.json(
            {
              message: "Invalid request body",
              errors: parsed.error.flatten().fieldErrors,
            },
            { status: 400 },
          );
        }

        const { weeklyCharacterLimit, includeAdmins } = parsed.data;
        const normalizedAdminEmail =
          process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined;

        const updateScopeWhere = buildUpdateScopeWhere({
          includeAdmins,
          adminEmail: normalizedAdminEmail,
        });

        const scannedResult = await req.payload.count({
          collection: "users",
          overrideAccess: true,
          where: updateScopeWhere,
        });

        let skippedAdmins = 0;
        if (!includeAdmins) {
          const adminWhere: Where = normalizedAdminEmail
            ? {
                or: [
                  {
                    role: {
                      equals: "admin",
                    },
                  },
                  {
                    email: {
                      equals: normalizedAdminEmail,
                    },
                  },
                ],
              }
            : {
                role: {
                  equals: "admin",
                },
              };

          const skippedAdminsResult = await req.payload.count({
            collection: "users",
            overrideAccess: true,
            where: adminWhere,
          });

          skippedAdmins = skippedAdminsResult.totalDocs;
        }

        const updateWhere: Where = {
          and: [
            updateScopeWhere,
            {
              weeklyCharacterLimit: {
                not_equals: weeklyCharacterLimit,
              },
            },
          ],
        };

        const updateCountResult = await req.payload.count({
          collection: "users",
          overrideAccess: true,
          where: updateWhere,
        });

        let updated = 0;
        if (updateCountResult.totalDocs > 0) {
          const updateResult = await req.payload.update({
            collection: "users",
            overrideAccess: true,
            where: updateWhere,
            limit: updateCountResult.totalDocs,
            data: {
              weeklyCharacterLimit,
            },
          });

          updated = updateResult.docs.length;
        }

        return Response.json(
          {
            ok: true,
            summary: {
              scanned: scannedResult.totalDocs,
              updated,
              skippedAdmins,
            },
          },
          { status: 200 },
        );
      },
    },
  ],
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "user",
      options: [
        {
          label: "User",
          value: "user",
        },
        {
          label: "Admin",
          value: "admin",
        },
      ],
      access: {
        create: isAdminAccess,
        read: isAdminAccess,
        update: isAdminAccess,
      },
      admin: {
        position: "sidebar",
        description: "Administrative role used for privileged console actions.",
      },
    },
    {
      name: "weeklyCharacterLimit",
      type: "number",
      required: true,
      defaultValue: DEFAULT_WEEKLY_CHARACTER_LIMIT,
      min: 0,
      access: {
        create: isAdminAccess,
        read: isAdminAccess,
        update: isAdminAccess,
      },
      admin: {
        position: "sidebar",
        description:
          "Maximum number of synthesized characters this user can consume per UTC week.",
      },
    },
  ],
};
