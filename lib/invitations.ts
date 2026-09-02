import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { requirePermission, type Role } from "@/lib/auth";
import { getMailSettings } from "@/lib/app-config";
import { validatePassword } from "@/lib/password-policy";

function hash(token: string) { return createHash("sha256").update(token).digest("hex"); }

async function sendInvitationEmail(email: string, name: string, token: string) {
  const mail = await getMailSettings();
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!mail.smtpHost || !mail.smtpUser || !mail.smtpPassword || !mail.emailFrom || !baseUrl) throw new Error("Email delivery is not configured.");
  const transporter = nodemailer.createTransport({ host: mail.smtpHost, port: mail.smtpPort, secure: mail.smtpPort === 465, auth: { user: mail.smtpUser, pass: mail.smtpPassword } });
  await transporter.sendMail({ from: mail.emailFrom, to: email, subject: "Your St. Paul's site invitation", text: `Hello ${name}, accept your invitation here: ${baseUrl}/invite?token=${token}` });
}

export async function createInvitation(input: { email: string; name: string; role: Role; groupId: string | null }) {
  const creator = await requirePermission("MANAGE_USERS");
  const email = input.email.toLowerCase().trim();
  if (!email.includes("@") || input.name.trim().length < 2) throw new Error("Provide a valid name and email.");
  if (input.groupId && !(await db.securityGroup.findUnique({ where: { id: input.groupId }, select: { id: true } }))) throw new Error("Invalid security group.");
  const token = randomBytes(32).toString("hex");
  await db.userInvitation.deleteMany({ where: { email, acceptedAt: null } });
  await db.userInvitation.create({ data: { email, name: input.name.trim(), role: input.role, groupId: input.groupId, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: creator.id } });
  await sendInvitationEmail(email, input.name.trim(), token);
}

export async function listPendingInvitations() {
  await requirePermission("MANAGE_USERS");
  return db.userInvitation.findMany({
    where: { acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true, group: { select: { name: true } } }
  });
}

export async function resendInvitation(id: string) {
  await requirePermission("MANAGE_USERS");
  const invitation = await db.userInvitation.findUnique({ where: { id }, select: { id: true, email: true, name: true, acceptedAt: true } });
  if (!invitation || invitation.acceptedAt) throw new Error("Invitation is no longer pending.");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.userInvitation.update({ where: { id }, data: { tokenHash: hash(token), expiresAt, createdAt: new Date() } });
  await sendInvitationEmail(invitation.email, invitation.name, token);
}

export async function revokeInvitation(id: string) {
  await requirePermission("MANAGE_USERS");
  const invitation = await db.userInvitation.findUnique({ where: { id }, select: { id: true, acceptedAt: true } });
  if (!invitation || invitation.acceptedAt) throw new Error("Invitation is no longer pending.");
  await db.userInvitation.delete({ where: { id } });
}

export async function acceptInvitation(token: string, password: string) {
  const invitation = await db.userInvitation.findUnique({ where: { tokenHash: hash(token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new Error("This invitation is invalid or expired.");
  const passwordError = await validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  const bcrypt = (await import("bcryptjs")).default;
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email: invitation.email, name: invitation.name, passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: new Date(), role: invitation.role, groupId: invitation.groupId } });
    await tx.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    return created;
  });
  return user.id;
}
