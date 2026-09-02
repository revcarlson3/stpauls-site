import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getMailSettings } from "@/lib/app-config";

export type UserCreationSource = "administrator" | "invitation" | "self-registration";

export async function notifyUserCreated(input: { name: string; createdAt: Date; source: UserCreationSource }) {
  const recipients = await db.user.findMany({
    where: { isActive: true, group: { permissions: { some: { permission: "MANAGE_USERS" } } } },
    select: { email: true }
  });
  if (!recipients.length) return;

  const mail = await getMailSettings();
  if (!mail.smtpHost || !mail.smtpUser || !mail.smtpPassword || !mail.emailFrom) {
    console.error("User creation notification was not sent because email delivery is not configured.");
    return;
  }

  const transporter = nodemailer.createTransport({ host: mail.smtpHost, port: mail.smtpPort, secure: mail.smtpPort === 465, auth: { user: mail.smtpUser, pass: mail.smtpPassword } });
  try {
    await transporter.sendMail({
      from: mail.emailFrom,
      bcc: recipients.map((recipient) => recipient.email),
      subject: "New user account created",
      text: `A new user account was created.\n\nName: ${input.name}\nDate created: ${input.createdAt.toLocaleString()}\nCreated by: ${input.source}.`
    });
  } catch (error) {
    console.error("User creation notification could not be sent.", error);
  }
}
