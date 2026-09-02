import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getMailSettings } from "@/lib/app-config";
import { logAudit } from "@/lib/audit";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestEmailChange(email: string) {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Unauthorized: a server-side authenticated session is required.");
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.includes("@")) throw new Error("Provide a valid email address.");
  if (normalizedEmail === (await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true } })).email) throw new Error("That is already your current email address.");
  if (await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) throw new Error("That email address is already in use.");

  const token = randomBytes(32).toString("hex");
  await db.emailChangeToken.deleteMany({ where: { userId: actor.id } });
  await db.emailChangeToken.create({ data: { userId: actor.id, email: normalizedEmail, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  const mail = await getMailSettings();
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!mail.smtpHost || !mail.smtpUser || !mail.smtpPassword || !mail.emailFrom || !baseUrl) throw new Error("Email delivery is not configured.");
  const transporter = nodemailer.createTransport({ host: mail.smtpHost, port: mail.smtpPort, secure: mail.smtpPort === 465, auth: { user: mail.smtpUser, pass: mail.smtpPassword } });
  await transporter.sendMail({ from: mail.emailFrom, to: normalizedEmail, subject: "Confirm your new St. Paul's email address", text: `Confirm your new email address here: ${baseUrl}/api/account/email/verify?token=${token}` });
  await logAudit({ activityType: "email-change-requested", summary: `Requested email change for ${actor.name}`, details: `New address: ${normalizedEmail}.`, actorId: actor.id });
}

export async function confirmEmailChange(token: string) {
  const record = await db.emailChangeToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.expiresAt < new Date()) throw new Error("Email change link is invalid or expired.");
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { email: record.email, emailVerifiedAt: new Date() } }),
    db.emailChangeToken.delete({ where: { id: record.id } })
  ]);
  await logAudit({ activityType: "email-changed", summary: `Changed email address for user`, details: `New address: ${record.email}.`, actorId: record.userId });
}
