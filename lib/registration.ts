import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

type RegistrationInput = { firstName: string; lastName: string; email: string; churchCode?: string };

export async function registerUser(input: RegistrationInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.toLowerCase().trim();
  if (!firstName || !lastName || !email.includes("@")) throw new Error("Invalid registration details.");

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const churchMember = isChurchCodeValid(input.churchCode);
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
  return { id: user.id, memberLinked: Boolean(member) };
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record || record.expiresAt < new Date()) throw new Error("Verification link is invalid or expired.");
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(tokenHash))) throw new Error("Verification link is invalid.");
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerificationToken.delete({ where: { id: record.id } })
  ]);
  return record.userId;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isChurchCodeValid(code?: string) {
  const expected = process.env.CHURCH_REGISTRATION_CODE;
  if (!code || !expected) return false;
  const provided = Buffer.from(code);
  const expectedBuffer = Buffer.from(expected);
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

async function sendVerificationEmail(email: string, name: string, token: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, NEXTAUTH_URL } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM || !NEXTAUTH_URL) {
    throw new Error("Email delivery is not configured.");
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Verify your St. Paul's account",
    text: `Hello ${name}, verify your account here: ${NEXTAUTH_URL}/api/register/verify?token=${token}`
  });
}

