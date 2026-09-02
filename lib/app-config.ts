import crypto from "node:crypto";
import { db } from "@/lib/db";

function key() {
  return crypto.createHash("sha256").update(process.env.NEXTAUTH_SECRET ?? "development-only-config-key").digest();
}

export function encryptConfig(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptConfig(value: string | null) {
  if (!value) return "";
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !encrypted) throw new Error("Stored configuration is invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function getMailSettings() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 } });
  return {
    smtpHost: settings?.smtpHost ?? "",
    smtpPort: settings?.smtpPort ?? 587,
    smtpUser: settings?.smtpUser ?? "",
    smtpPassword: decryptConfig(settings?.smtpPasswordEncrypted ?? null),
    emailFrom: settings?.emailFrom ?? ""
  };
}

export async function getRegistrationCode() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { registrationCodeEncrypted: true } });
  return decryptConfig(settings?.registrationCodeEncrypted ?? null);
}
