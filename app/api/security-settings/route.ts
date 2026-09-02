import { NextResponse } from "next/server";
import { getSecuritySettings, updateSecuritySettings } from "@/lib/security-settings";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try { await requirePermission("MANAGE_SETTINGS"); return NextResponse.json(await getSecuritySettings()); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 }); return NextResponse.json({ error: "Unable to load security settings." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  const normalized = {
    loginProtectionEnabled: input?.loginProtectionEnabled,
    maxFailedAttempts: input?.maxFailedAttempts,
    lockoutMinutes: input?.lockoutMinutes,
    captchaMode: input?.captchaMode,
    emailMfaEnabled: input?.emailMfaEnabled,
    smsMfaEnabled: input?.smsMfaEnabled,
    authenticatorMfaEnabled: input?.authenticatorMfaEnabled,
    recaptchaSiteKey: typeof input?.recaptchaSiteKey === "string" ? input.recaptchaSiteKey : "",
    recaptchaSecret: typeof input?.recaptchaSecret === "string" ? input.recaptchaSecret : "",
    smsProvider: input?.smsProvider,
    smsAccountId: typeof input?.smsAccountId === "string" ? input.smsAccountId : "",
    smsAuthSecret: typeof input?.smsAuthSecret === "string" ? input.smsAuthSecret : "",
    smsFrom: typeof input?.smsFrom === "string" ? input.smsFrom : "",
    totpIssuer: typeof input?.totpIssuer === "string" ? input.totpIssuer : ""
  };
  if (!input || typeof normalized.loginProtectionEnabled !== "boolean" || !Number.isInteger(normalized.maxFailedAttempts) || normalized.maxFailedAttempts < 1 || normalized.maxFailedAttempts > 20 || !Number.isInteger(normalized.lockoutMinutes) || normalized.lockoutMinutes < 1 || normalized.lockoutMinutes > 1440 || !["off", "challenge", "recaptcha-v3"].includes(normalized.captchaMode) || typeof normalized.emailMfaEnabled !== "boolean" || typeof normalized.smsMfaEnabled !== "boolean" || typeof normalized.authenticatorMfaEnabled !== "boolean" || !["twilio", "vonage", "aws-sns"].includes(normalized.smsProvider)) return NextResponse.json({ error: "Invalid security settings. Unused provider fields may be left blank." }, { status: 400 });
  try { return NextResponse.json(await updateSecuritySettings(normalized)); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    if (error instanceof Error && (error.message.includes("Unknown argument") || error.message.includes("does not exist"))) return NextResponse.json({ error: "The database schema is missing the security provider fields. Run npm run db:push and try again." }, { status: 503 });
    return NextResponse.json({ error: "Unable to save security settings." }, { status: 500 });
  }
}
