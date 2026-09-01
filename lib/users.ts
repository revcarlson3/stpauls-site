import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePermission, type Role } from "@/lib/auth";
import type { Permission } from "@prisma/client";

export async function createUser(input: { email: string; name: string; password: string; role: Role }) {
  await requirePermission("MANAGE_USERS");
  return saveUser(input);
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

export async function saveUser(input: { email: string; name: string; password: string; role: Role }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return db.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
      role: input.role
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });
}
