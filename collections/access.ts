import type { Access } from "payload";

type AccessUser = {
  collection?: string | null;
  email?: string | null;
};

export function isAdminUser(user?: AccessUser | null) {
  if (!user) {
    return false;
  }

  if (user.collection === "admins") {
    return true;
  }

  return false;
}

export const isAdmin: Access = ({ req: { user } }) => isAdminUser(user);

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user);
