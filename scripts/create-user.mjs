import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const required = ["USER_EMAIL", "USER_NAME", "USER_PASSWORD", "USER_ROLE"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
if (!["viewer", "editor", "admin"].includes(process.env.USER_ROLE)) throw new Error("USER_ROLE must be viewer, editor, or admin.");
if (process.env.USER_PASSWORD.length < 12) throw new Error("USER_PASSWORD must be at least 12 characters.");

const db = new PrismaClient();
try {
  const group = await db.securityGroup.findUnique({ where: { slug: process.env.USER_ROLE === "admin" ? "administrator" : process.env.USER_ROLE } });
  const user = await db.user.create({
    data: {
      email: process.env.USER_EMAIL.toLowerCase().trim(),
      name: process.env.USER_NAME.trim(),
      passwordHash: await bcrypt.hash(process.env.USER_PASSWORD, 12),
      role: process.env.USER_ROLE,
      groupId: group?.id ?? null
    },
    select: { id: true, email: true, name: true, role: true }
  });
  console.log(`Created ${user.role} user ${user.email} (${user.id})`);
} finally {
  await db.$disconnect();
}
