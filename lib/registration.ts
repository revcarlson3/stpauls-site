import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getMailSettings, getRegistrationCode } from "@/lib/app-config";
import { validatePassword } from "@/lib/password-policy";
import { notifyUserCreated } from "@/lib/user-notifications";
import { logAudit } from "@/lib/audit";

type RegistrationInput = { firstName: string; lastName: string; email: string; churchCode?: string };

export async function registerUser(input: RegistrationInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.toLowerCase().trim();
  if (!firstName || !lastName || !email.includes("@")) throw new Error("Invalid registration details.");

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const churchMember = await isChurchCodeValid(input.churchCode);
  const member = churchMember
    ? await db.memberProfile.findFirst({ where: { email, userId: null, firstName, lastName } })
    : null;
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: `${firstName} ${lastName}`,
        role: "viewer",
        emailVerifiedAt: null,
        memberProfile: member ? { connect: { id: member.id } } : undefined,
        verificationTokens: { create: { tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
      }
    });
    return created;
  });

  await sendVerificationEmail(email, `${firstName} ${lastName}`, token);
  await notifyUserCreated({ name: user.name, createdAt: user.createdAt, source: "self-registration" });
  await logAudit({ activityType: "user-created", summary: `Created user ${user.name}`, details: `Email: ${user.email}. Source: self-registration.` });
  return { id: user.id, memberLinked: Boolean(member) };
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record || record.expiresAt < new Date()) throw new Error("Verification link is invalid or expired.");
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(tokenHash))) throw new Error("Verification link is invalid.");
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return record.userId;
}

export async function setPassword(token: string, password: string) {
  const passwordError = await validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.expiresAt < new Date()) throw new Error("Verification link is invalid or expired.");
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
    db.emailVerificationToken.delete({ where: { id: record.id } })
  ]);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function isChurchCodeValid(code?: string) {
  const expected = await getRegistrationCode();
  if (!code || !expected) return false;
  const provided = Buffer.from(code);
  const expectedBuffer = Buffer.from(expected);
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

async function sendVerificationEmail(email: string, name: string, token: string) {
  const { smtpHost, smtpPort, smtpUser, smtpPassword, emailFrom } = await getMailSettings();
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !emailFrom || !NEXTAUTH_URL) {
    throw new Error("Email delivery is not configured.");
  }
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword }
  });
  await transporter.sendMail({
    from: emailFrom,
    to: email,
    subject: "Verify your St. Paul's account",
    text: `Hello ${name}, verify your account here: ${NEXTAUTH_URL}/api/register/verify?token=${token}`
  });
}
