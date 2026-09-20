import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, type Role } from "@/lib/auth";
import type { Permission } from "@prisma/client";
import { validatePassword } from "@/lib/password-policy";
import { notifyUserCreated } from "@/lib/user-notifications";
import { logAudit } from "@/lib/audit";
import { requireCurrentChurch } from "@/lib/tenant";
import { canEditSecurityGroupPermissions, canRenameSecurityGroup, isSystemSecurityGroup } from "@/lib/security-group-policy";

export function securityGroupScope(churchId: string) {
  return { churchId };
}

export async function createUser(input: { email: string; name: string; password: string; role: Role; groupId?: string | null }) {
  const actor = await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  if (input.groupId && !(await db.securityGroup.findFirst({ where: { id: input.groupId, ...securityGroupScope(church.id) }, select: { id: true } }))) {
    throw new Error("Invalid security group.");
  }
  const user = await saveUser(input, church.id);
  await logAudit({ activityType: "user-created", summary: `Created user ${user.name}`, details: `Email: ${user.email}. Source: administrator.`, actorId: actor.id });
  await notifyUserCreated({ name: user.name, createdAt: user.createdAt, source: "administrator" });
  return user;
}

export async function createSecurityGroup(input: { name: string; slug: string; permissions: Permission[] }) {
  const actor = await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  const group = await db.securityGroup.create({
    data: {
      ...securityGroupScope(church.id),
      name: input.name.trim(),
      slug: input.slug,
      permissions: { create: input.permissions.map((permission) => ({ permission })) }
    },
    include: { permissions: true, _count: { select: { users: true } } }
  });
  await logAudit({ activityType: "group-created", summary: `Created security group ${group.name}`, actorId: actor.id });
  return group;
}

export async function listSecurityGroups() {
  await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  return db.securityGroup.findMany({
    where: securityGroupScope(church.id),
    orderBy: { name: "asc" },
    include: { permissions: true, _count: { select: { users: true } } }
  });
}

export async function listUsers() {
  const actor = await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  const users = await db.user.findMany({
    where: { churchMemberships: { some: { churchId: church.id } }, isPlatformAdmin: false },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, groupId: true, group: { select: { name: true } } }
  });
  return users.map((user) => ({ ...user, isCurrent: user.id === actor.id }));
}

export async function assignUserGroup(id: string, groupId: string | null) {
  await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  await requireTenantManagedUser(id);
  if (groupId && !(await db.securityGroup.findFirst({ where: { id: groupId, ...securityGroupScope(church.id) }, select: { id: true } }))) throw new Error("Invalid security group.");
  return db.user.update({
    where: { id, churchMemberships: { some: { churchId: church.id } } },
    data: { groupId },
    select: { id: true, email: true, name: true, role: true, groupId: true, group: { select: { name: true } } }
  });
}

export async function updateUserAccount(input: { id: string; name: string; email: string; password?: string; groupId: string | null; isActive: boolean }) {
  const actor = await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  await requireTenantManagedUser(input.id);
  if (input.groupId && !(await db.securityGroup.findFirst({ where: { id: input.groupId, ...securityGroupScope(church.id) }, select: { id: true } }))) throw new Error("Invalid security group.");
  if (actor.id === input.id) {
    if (!input.isActive) throw new Error("You cannot deactivate your own account.");
    const current = await db.user.findUnique({ where: { id: input.id }, select: { groupId: true } });
    if (current?.groupId !== input.groupId) throw new Error("You cannot change your own security group.");
  }
  const data: { name: string; email: string; groupId: string | null; isActive: boolean; passwordHash?: string } = {
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    groupId: input.groupId,
    isActive: input.isActive
  };
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);
  const updated = await db.user.update({
    where: { id: input.id, churchMemberships: { some: { churchId: church.id } } },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true, groupId: true, group: { select: { name: true } } }
  });
  await logAudit({ activityType: "user-updated", summary: `Updated user ${updated.name}`, details: `Email: ${updated.email}.`, actorId: actor.id });
  return { ...updated, isCurrent: updated.id === actor.id };
}

export async function deleteUser(id: string) {
  const actor = await requirePermission("MANAGE_USERS");
  if (actor.id === id) throw new Error("You cannot delete your own account.");
  await requireTenantManagedUser(id);
  const { church } = await requireCurrentChurch();
  await db.user.delete({ where: { id, churchMemberships: { some: { churchId: church.id } } } });
  await logAudit({ activityType: "user-deleted", summary: `Deleted user account`, details: `User ID: ${id}.`, actorId: actor.id });
}

export async function getOwnAccount() {
  const actor = await requireOwnAccount();
  return db.user.findUnique({ where: { id: actor.id }, select: { id: true, email: true, name: true, emailVerifiedAt: true, isPlatformAdmin: true } }).then((account) => account ? { ...account, canAccessAdmin: actor.canAccessAdmin, isAdministrator: actor.role === "admin", permissions: actor.permissions } : account);
}

export async function signOutAllSessions() {
  const actor = await requireOwnAccount();
  await db.user.update({ where: { id: actor.id }, data: { sessionVersion: { increment: 1 }, lastSessionRevokedAt: new Date() } });
  await logAudit({ activityType: "sessions-revoked", summary: "Revoked all sessions", actorId: actor.id });
}

export async function updateOwnAccount(input: { name: string; currentPassword?: string; newPassword?: string }) {
  const actor = await requireOwnAccount();
  if (input.name.trim().length < 2) throw new Error("Name must be at least 2 characters.");
  if (input.newPassword) {
    if (!input.currentPassword) throw new Error("Current password is required to change your password.");
    const current = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
    if (!current?.passwordHash || !(await bcrypt.compare(input.currentPassword, current.passwordHash))) throw new Error("Current password is incorrect.");
    const passwordError = await validatePassword(input.newPassword);
    if (passwordError) throw new Error(`New ${passwordError.toLowerCase()}`);
  }
  return db.user.update({
    where: { id: actor.id },
    data: { name: input.name.trim(), passwordHash: input.newPassword ? await bcrypt.hash(input.newPassword, 12) : undefined },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });
}

async function requireOwnAccount() {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Unauthorized: a server-side authenticated session is required.");
  return actor;
}

export async function updateSecurityGroup(id: string, input: { name: string; permissions: Permission[] }) {
  await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  const existing = await db.securityGroup.findFirst({ where: { id, ...securityGroupScope(church.id) }, select: { slug: true, name: true } });
  if (!existing) throw new Error("Security group not found.");
  if (!canRenameSecurityGroup(existing.slug) && input.name.trim() !== existing.name) throw new Error("The default security groups cannot be renamed.");
  if (!canEditSecurityGroupPermissions(existing.slug)) throw new Error("The default security groups cannot be changed.");
  return db.securityGroup.update({
    where: { id },
    data: {
      name: input.name.trim(),
      permissions: {
        deleteMany: {},
        create: input.permissions.map((permission) => ({ permission }))
      }
    },
    include: { permissions: true, _count: { select: { users: true } } }
  });
}

export async function deleteSecurityGroup(id: string) {
  await requirePermission("MANAGE_USERS");
  const { church } = await requireCurrentChurch();
  const group = await db.securityGroup.findFirst({ where: { id, ...securityGroupScope(church.id) }, select: { slug: true } });
  if (!group) throw new Error("Security group not found.");
  if (isSystemSecurityGroup(group.slug)) {
    throw new Error("The default security groups cannot be deleted.");
  }
  await db.securityGroup.delete({ where: { id } });
}

export async function saveUser(input: { email: string; name: string; password: string; role: Role; groupId?: string | null }, churchId?: string) {
  const passwordError = await validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);
  const passwordHash = await bcrypt.hash(input.password, 12);
  return db.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
      role: input.role,
      groupId: input.groupId ?? null,
      ...(churchId ? { churchMemberships: { create: { churchId, role: input.role === "admin" ? "ADMIN" : "MEMBER" } } } : {})
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });
}

export function isTenantManagedUser(isPlatformAdmin: boolean) {
  return !isPlatformAdmin;
}

async function requireTenantManagedUser(id: string) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, isPlatformAdmin: true } });
  if (!user || !isTenantManagedUser(user.isPlatformAdmin)) throw new Error("Tenant user was not found.");
  return user;
}
