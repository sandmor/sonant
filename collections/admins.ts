import type { CollectionConfig } from "payload";

const isAdminCollectionUser = ({
  req,
}: {
  req: { user?: { collection?: string | null } | null };
}) => req.user?.collection === "admins";

export const Admins: CollectionConfig = {
  slug: "admins",
  auth: true,
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "updatedAt", "createdAt"],
  },
  access: {
    admin: isAdminCollectionUser,
    create: isAdminCollectionUser,
    read: isAdminCollectionUser,
    update: isAdminCollectionUser,
    delete: isAdminCollectionUser,
  },
  fields: [],
};
