import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const required = ["USER_EMAIL", "USER_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
if (process.env.USER_PASSWORD.length < 12) throw new Error("USER_PASSWORD must be at least 12 characters.");

const db = new PrismaClient();
try {
  const email = process.env.USER_EMAIL.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } });
  if (!user) throw new Error(`No user found for ${email}. Check DATABASE_URL and USER_EMAIL.`);
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(process.env.USER_PASSWORD, 12), failedLoginAttempts: 0, loginWindowStartedAt: null, lockedUntil: null, sessionVersion: { increment: 1 } },
    select: { email: true, isActive: true }
  });
  console.log(`Password reset for ${updated.email}. Active account: ${updated.isActive}.`);
} finally {
  await db.$disconnect();
}
