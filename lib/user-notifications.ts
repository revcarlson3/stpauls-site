import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getMailSettings } from "@/lib/app-config";

export type UserCreationSource = "administrator" | "invitation" | "self-registration";

function transporterFor(mail: Awaited<ReturnType<typeof getMailSettings>>) {
  if (!mail.smtpHost || !mail.smtpUser || !mail.smtpPassword || !mail.emailFrom) return null;
  return nodemailer.createTransport({ host: mail.smtpHost, port: mail.smtpPort, secure: mail.smtpPort === 465, auth: { user: mail.smtpUser, pass: mail.smtpPassword } });
}

export async function notifyUserCreated(input: { name: string; createdAt: Date; source: UserCreationSource }) {
  const recipients = await db.user.findMany({ where: { isActive: true, group: { permissions: { some: { permission: "MANAGE_USERS" } } } }, select: { email: true } });
  if (!recipients.length) return;
  const mail = await getMailSettings();
  const transporter = transporterFor(mail);
  if (!transporter) { console.error("User creation notification was not sent because email delivery is not configured."); return; }
  try {
    await transporter.sendMail({ from: mail.emailFrom!, bcc: recipients.map((recipient) => recipient.email), subject: "New user account created", text: `A new user account was created.\n\nName: ${input.name}\nDate created: ${input.createdAt.toLocaleString()}\nCreated by: ${input.source}.` });
  } catch (error) { console.error("User creation notification could not be sent.", error); }
}

export async function notifyMemberLinkRequested(input: { name: string; email: string; createdAt: Date }) {
  const recipients = await db.user.findMany({ where: { isActive: true, group: { permissions: { some: { permission: "MANAGE_USERS" } } } }, select: { email: true } });
  if (!recipients.length) return;
  const mail = await getMailSettings();
  const transporter = transporterFor(mail);
  if (!transporter) { console.error("Member link notification was not sent because email delivery is not configured."); return; }
  try {
    await transporter.sendMail({ from: mail.emailFrom!, bcc: recipients.map((recipient) => recipient.email), subject: "New membership link request", text: `A user requested access to an existing membership record.\n\nName: ${input.name}\nEmail: ${input.email}\nDate requested: ${input.createdAt.toLocaleString()}` });
  } catch (error) { console.error("Member link notification could not be sent.", error); }
}

export async function notifyMemberLinkDecision(input: { email: string; approved: boolean; memberName?: string }) {
  const mail = await getMailSettings();
  const transporter = transporterFor(mail);
  if (!transporter) { console.error("Member link decision email was not sent because email delivery is not configured."); return; }
  const outcome = input.approved ? `Your account is now linked to ${input.memberName ?? "your membership record"}.` : "Your membership link request was declined.";
  try {
    await transporter.sendMail({ from: mail.emailFrom!, to: input.email, subject: input.approved ? "Membership access approved" : "Membership access request update", text: outcome });
  } catch (error) { console.error("Member link decision email could not be sent.", error); }
}
