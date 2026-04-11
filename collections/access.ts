import type { Access } from "payload";

type AccessUser = {
  email?: string | null;
  role?: string | null;
};

export function isAdminUser(user?: AccessUser | null) {
  if (!user) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) {
    return false;
  }

  return user.email?.toLowerCase() === adminEmail;
}

export const isAdmin: Access = ({ req: { user } }) => isAdminUser(user);

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user);
