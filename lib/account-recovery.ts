import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getMailSettings } from "@/lib/app-config";
import { validatePassword } from "@/lib/password-policy";

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  await sendResetEmail(user.email, user.name, token);
}

export async function resetPassword(token: string, password: string) {
  const passwordError = await validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  const tokenHash = hashToken(token);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) throw new Error("Reset link is invalid or expired.");
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(tokenHash))) throw new Error("Reset link is invalid.");
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
    db.passwordResetToken.delete({ where: { id: record.id } })
  ]);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(email: string, name: string, token: string) {
  const { smtpHost, smtpPort, smtpUser, smtpPassword, emailFrom } = await getMailSettings();
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !emailFrom || !NEXTAUTH_URL) throw new Error("Email delivery is not configured.");
  const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPassword } });
  await transporter.sendMail({ from: emailFrom, to: email, subject: "Reset your St. Paul's account password", text: `Hello ${name}, reset your password here: ${NEXTAUTH_URL}/reset-password?token=${token}` });
}
