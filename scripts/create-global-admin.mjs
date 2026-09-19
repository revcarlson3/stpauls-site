import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const rl = readline.createInterface({ input, output });
const ask = (question) => rl.question(question);
try {
  const email = (await ask("Email: ")).trim().toLowerCase();
  const name = (await ask("Name: ")).trim();
  const password = await ask("Password (12+ characters): ");
  if (!email || !name || password.length < 12) throw new Error("Email, name, and a password of at least 12 characters are required.");
  const db = new PrismaClient();
  try {
    const user = await db.user.upsert({
      where: { email },
      update: { name, passwordHash: await bcrypt.hash(password, 12), role: "admin", isPlatformAdmin: true, isActive: true, mfaEnabled: false, mfaSecretEncrypted: null, mfaRecoveryCodesEncrypted: null, mfaEnrolledAt: null },
      create: { email, name, passwordHash: await bcrypt.hash(password, 12), role: "admin", isPlatformAdmin: true, isActive: true },
      select: { id: true, email: true, name: true }
    });
    console.log(`Global administrator ready: ${user.name} <${user.email}>`);
    console.log("The administrator must sign in at /global-admin/login and complete authenticator MFA setup.");
  } finally {
    await db.$disconnect();
  }
} finally {
  rl.close();
}
