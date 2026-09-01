import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export type Role = "viewer" | "editor" | "admin";

export type User = {
  id: string;
  name: string;
  role: Role;
};

const roleRank: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export function getCurrentUser() {
  return getServerSession(authOptions).then((session) => {
    const role = session?.user?.role;
    if (!session?.user?.id || !isRole(role)) return null;
    return { id: session.user.id, name: session.user.name ?? session.user.email ?? "User", role };
  });
}

export async function requireRole(requiredRole: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user || roleRank[user.role] < roleRank[requiredRole]) {
    throw new Error("Unauthorized: a server-side authenticated session is required.");
  }
  return user;
}

function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "editor" || value === "admin";
}
