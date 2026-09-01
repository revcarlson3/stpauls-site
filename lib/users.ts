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
    include: { permissions: true }
  });
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
