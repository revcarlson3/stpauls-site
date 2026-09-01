import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole, type Role } from "@/lib/auth";

export async function createUser(input: { email: string; name: string; password: string; role: Role }) {
  await requireRole("admin");
  return saveUser(input);
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

