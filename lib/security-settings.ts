import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { encryptConfig } from "@/lib/app-config";

export const defaultSecuritySettings = {
  loginProtectionEnabled: true,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  captchaMode: "off" as "off" | "challenge" | "recaptcha-v3",
  emailMfaEnabled: false,
  smsMfaEnabled: false,
  authenticatorMfaEnabled: false,
  recaptchaSiteKey: "",
  recaptchaSecret: "",
  recaptchaConfigured: false,
  smsProvider: "twilio" as "twilio" | "vonage" | "aws-sns",
  smsAccountId: "",
  smsAuthSecret: "",
  smsConfigured: false,
  smsFrom: "",
  totpIssuer: "St. Paul's Site"
};

export async function getSecuritySettings() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 } });
  if (!settings) return defaultSecuritySettings;
  const { recaptchaSecretEncrypted, smsAuthSecretEncrypted, ...safeSettings } = settings;
  return { ...safeSettings, recaptchaSecret: "", recaptchaConfigured: Boolean(recaptchaSecretEncrypted), smsAuthSecret: "", smsConfigured: Boolean(smsAuthSecretEncrypted) };
}

export async function updateSecuritySettings(input: typeof defaultSecuritySettings) {
  await requirePermission("MANAGE_SETTINGS");
  const current = await db.securitySettings.findUnique({ where: { id: 1 }, select: { recaptchaSecretEncrypted: true, smsAuthSecretEncrypted: true } });
  const data = {
    loginProtectionEnabled: input.loginProtectionEnabled, maxFailedAttempts: input.maxFailedAttempts, lockoutMinutes: input.lockoutMinutes,
    captchaMode: input.captchaMode, emailMfaEnabled: input.emailMfaEnabled, smsMfaEnabled: input.smsMfaEnabled, authenticatorMfaEnabled: input.authenticatorMfaEnabled,
    recaptchaSiteKey: input.recaptchaSiteKey.trim(), recaptchaSecretEncrypted: input.recaptchaSecret ? encryptConfig(input.recaptchaSecret) : current?.recaptchaSecretEncrypted ?? null,
    smsProvider: input.smsProvider, smsAccountId: input.smsAccountId.trim(), smsAuthSecretEncrypted: input.smsAuthSecret ? encryptConfig(input.smsAuthSecret) : current?.smsAuthSecretEncrypted ?? null,
    smsFrom: input.smsFrom.trim(), totpIssuer: input.totpIssuer.trim() || "St. Paul's Site"
  };
  return db.securitySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } }).then((settings) => {
    const { recaptchaSecretEncrypted, smsAuthSecretEncrypted, ...safeSettings } = settings;
    return { ...safeSettings, recaptchaSecret: "", recaptchaConfigured: Boolean(recaptchaSecretEncrypted), smsAuthSecret: "", smsConfigured: Boolean(smsAuthSecretEncrypted) };
  });
}
