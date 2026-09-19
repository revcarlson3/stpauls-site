import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import type { Permission } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { canAccessAdmin } from "@/lib/permissions";

export type Role = "viewer" | "editor" | "admin";

export type User = {
  id: string;
  name: string;
  role: Role;
  churchId: string | null;
  churchRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  isPlatformAdmin: boolean;
  effectiveGroupId: string | null;
  permissions: Permission[];
};

export function getCurrentUser() {
  return getServerSession(authOptions).then((session) => {
    const role = session?.user?.role;
    if (!session?.user?.id || !isRole(role)) return null;
    return db.user.findUnique({ where: { id: session.user.id }, select: { isActive: true, role: true, isPlatformAdmin: true, groupId: true, group: { select: { permissions: { select: { permission: true } } } }, churchMemberships: { where: { church: { status: "ACTIVE" } }, orderBy: { createdAt: "asc" }, take: 1, select: { churchId: true, role: true } } } }).then(async (membership) => {
      if (!membership?.isActive) return null;
      if (!membership.groupId && (membership.role === "admin" || membership.role === "editor")) {
        const group = await db.securityGroup.findUnique({ where: { slug: membership.role === "admin" ? "administrator" : "editor" }, select: { id: true, permissions: { where: { permission: "ACCESS_ADMIN" }, select: { permission: true } } } });
        if (group) {
          await db.user.update({ where: { id: session.user.id }, data: { groupId: group.id } });
          membership.group = group;
        }
      }
      let effectiveGroupId = membership.groupId;
      let effectivePermissions = membership.group?.permissions ?? [];
      const viewAsGroupId = cookies().get("viewAsGroupId")?.value;
      if (role === "admin" && session.user.authBoundary === "global-admin" && viewAsGroupId) {
        const viewAsGroup = await db.securityGroup.findUnique({ where: { id: viewAsGroupId }, select: { id: true, permissions: { select: { permission: true } } } });
        if (viewAsGroup) {
          effectiveGroupId = viewAsGroup.id;
          effectivePermissions = viewAsGroup.permissions;
        }
      }
      return {
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "User",
        role,
        churchId: membership.churchMemberships[0]?.churchId ?? null,
        churchRole: membership.churchMemberships[0]?.role ?? null,
        isPlatformAdmin: membership.isPlatformAdmin,
        effectiveGroupId,
        permissions: effectivePermissions.map((permission) => permission.permission),
        canAccessAdmin: canAccessAdmin(effectivePermissions.map((permission) => permission.permission))
      };
    });
  });
}

export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireAuthenticatedUser();
  const group = user.effectiveGroupId ? await db.securityGroup.findUnique({
    where: { id: user.effectiveGroupId },
    select: { permissions: { where: { permission }, select: { permission: true } } }
  }) : null;
  if (!group?.permissions.length) throw new Error("Unauthorized: required permission is missing.");
  return user;
}

export async function hasPermission(userId: string, permission: Permission) {
  const membership = await db.user.findUnique({
    where: { id: userId },
    select: { group: { select: { permissions: { where: { permission }, select: { permission: true } } } } }
  });
  return Boolean(membership?.group?.permissions.length);
}

async function requireAuthenticatedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: a server-side authenticated session is required.");
  return user;
}

function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "editor" || value === "admin";
}
