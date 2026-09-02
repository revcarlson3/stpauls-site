import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, type Role } from "@/lib/auth";
import type { Permission } from "@prisma/client";
import { validatePassword } from "@/lib/password-policy";
import { notifyUserCreated } from "@/lib/user-notifications";

export async function createUser(input: { email: string; name: string; password: string; role: Role; groupId?: string | null }) {
  await requirePermission("MANAGE_USERS");
  if (input.groupId && !(await db.securityGroup.findUnique({ where: { id: input.groupId }, select: { id: true } }))) {
    throw new Error("Invalid security group.");
  }
  const user = await saveUser(input);
  await notifyUserCreated({ name: user.name, createdAt: user.createdAt, source: "administrator" });
  return user;
}

export async function createSecurityGroup(input: { name: string; slug: string; permissions: Permission[] }) {
  await requirePermission("MANAGE_USERS");
  return db.securityGroup.create({
    data: {
      name: input.name.trim(),
      slug: input.slug,
      permissions: { create: input.permissions.map((permission) => ({ permission })) }
    },
    include: { permissions: true, _count: { select: { users: true } } }
  });
}

export async function listSecurityGroups() {
  await requirePermission("MANAGE_USERS");
  return db.securityGroup.findMany({
    orderBy: { name: "asc" },
    include: { permissions: true, _count: { select: { users: true } } }
  });
}

export async function listUsers() {
  const actor = await requirePermission("MANAGE_USERS");
  const users = await db.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, groupId: true, group: { select: { name: true } } }
  });
  return users.map((user) => ({ ...user, isCurrent: user.id === actor.id }));
}

export async function assignUserGroup(id: string, groupId: string | null) {
  await requirePermission("MANAGE_USERS");
  return db.user.update({
    where: { id },
    data: { groupId },
    select: { id: true, email: true, name: true, role: true, groupId: true, group: { select: { name: true } } }
  });
}

export async function updateUserAccount(input: { id: string; name: string; email: string; password?: string; groupId: string | null; isActive: boolean }) {
  const actor = await requirePermission("MANAGE_USERS");
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
    where: { id: input.id },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true, groupId: true, group: { select: { name: true } } }
  });
  return { ...updated, isCurrent: updated.id === actor.id };
}

export async function deleteUser(id: string) {
  const actor = await requirePermission("MANAGE_USERS");
  if (actor.id === id) throw new Error("You cannot delete your own account.");
  await db.user.delete({ where: { id } });
}

export async function getOwnAccount() {
  const actor = await requireOwnAccount();
  return db.user.findUnique({ where: { id: actor.id }, select: { id: true, email: true, name: true, emailVerifiedAt: true } });
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
  const group = await db.securityGroup.findUnique({ where: { id }, select: { slug: true } });
  if (!group) throw new Error("Security group not found.");
  if (["visitor", "editor", "administrator"].includes(group.slug)) {
    throw new Error("The default security groups cannot be deleted.");
  }
  await db.securityGroup.delete({ where: { id } });
}

export async function saveUser(input: { email: string; name: string; password: string; role: Role; groupId?: string | null }) {
  const passwordError = await validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);
  const passwordHash = await bcrypt.hash(input.password, 12);
  return db.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
      role: input.role,
      groupId: input.groupId ?? null
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });
}
