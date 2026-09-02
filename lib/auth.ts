import { getServerSession } from "next-auth";
import type { Permission } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";

export type Role = "viewer" | "editor" | "admin";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export function getCurrentUser() {
  return getServerSession(authOptions).then((session) => {
    const role = session?.user?.role;
    if (!session?.user?.id || !isRole(role)) return null;
    return db.user.findUnique({ where: { id: session.user.id }, select: { isActive: true, role: true, groupId: true, group: { select: { permissions: { where: { permission: "ACCESS_ADMIN" }, select: { permission: true } } } } } }).then(async (membership) => {
      if (!membership?.isActive) return null;
      if (!membership.groupId && (membership.role === "admin" || membership.role === "editor")) {
        const group = await db.securityGroup.findUnique({ where: { slug: membership.role === "admin" ? "administrator" : "editor" }, select: { id: true, permissions: { where: { permission: "ACCESS_ADMIN" }, select: { permission: true } } } });
        if (group) {
          await db.user.update({ where: { id: session.user.id }, data: { groupId: group.id } });
          membership.group = group;
        }
      }
      return {
      id: session.user.id,
      name: session.user.name ?? session.user.email ?? "User",
      role,
      canAccessAdmin: Boolean(membership?.group?.permissions.length)
      };
    });
  });
}

export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireAuthenticatedUser();
  const membership = await db.user.findUnique({
    where: { id: user.id },
    select: { group: { select: { permissions: { where: { permission }, select: { permission: true } } } } }
  });
  if (!membership?.group?.permissions.length) throw new Error("Unauthorized: required permission is missing.");
  return user;
}

async function requireAuthenticatedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: a server-side authenticated session is required.");
  return user;
}

function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "editor" || value === "admin";
}
