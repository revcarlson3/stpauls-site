import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const defaultSecuritySettings = {
  loginProtectionEnabled: true,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  captchaMode: "off" as "off" | "challenge" | "recaptcha-v3",
  emailMfaEnabled: false,
  smsMfaEnabled: false,
  authenticatorMfaEnabled: false
};

export async function getSecuritySettings() {
  return (await db.securitySettings.findUnique({ where: { id: 1 } })) ?? defaultSecuritySettings;
}

export async function updateSecuritySettings(input: typeof defaultSecuritySettings) {
  await requirePermission("MANAGE_SETTINGS");
  return db.securitySettings.upsert({ where: { id: 1 }, update: input, create: { id: 1, ...input } });
}
