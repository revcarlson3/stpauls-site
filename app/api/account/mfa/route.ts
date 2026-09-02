import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptConfig, encryptConfig } from "@/lib/app-config";
import {
  consumeRecoveryCode, createOtpAuthUri, createOtpChallenge, createTotpSecret,
  encryptRecoveryCodes, generateRecoveryCodes, normalizePhoneNumber, verifyOtpChallenge, verifyTotp
} from "@/lib/mfa";
import { sendEmailMfaCode, sendSmsMfaCode } from "@/lib/mfa-delivery";

async function accountUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: sign-in required.");
  return db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, emailVerifiedAt: true, passwordHash: true, mfaEnabled: true,
      mfaSecretEncrypted: true, mfaRecoveryCodesEncrypted: true, emailMfaEnabled: true,
      smsMfaEnabled: true, phoneNumber: true, phoneVerifiedAt: true
    }
  });
}

export async function GET() {
  try {
    const [user, settings] = await Promise.all([
      accountUser(),
      db.securitySettings.findUnique({
        where: { id: 1 },
        select: { authenticatorMfaEnabled: true, emailMfaEnabled: true, smsMfaEnabled: true, totpIssuer: true, smsProvider: true, smsAuthSecretEncrypted: true, smsAccountId: true, smsFrom: true }
      })
    ]);
    return NextResponse.json({
      available: Boolean(settings?.authenticatorMfaEnabled),
      enabled: Boolean(user?.mfaEnabled),
      authenticatorAvailable: Boolean(settings?.authenticatorMfaEnabled),
      emailAvailable: Boolean(settings?.emailMfaEnabled),
      smsAvailable: Boolean(settings?.smsMfaEnabled && settings.smsAuthSecretEncrypted && settings.smsAccountId && settings.smsFrom),
      issuer: settings?.totpIssuer ?? "St. Paul's Site",
      authenticatorEnabled: Boolean(user?.mfaEnabled),
      emailEnabled: Boolean(user?.emailMfaEnabled),
      emailVerified: Boolean(user?.emailVerifiedAt),
      smsEnabled: Boolean(user?.smsMfaEnabled),
      phoneNumber: user?.phoneNumber ?? null,
      phoneVerified: Boolean(user?.phoneVerifiedAt),
      recoveryCodesRemaining: user?.mfaRecoveryCodesEncrypted ? JSON.parse(decryptConfig(user.mfaRecoveryCodesEncrypted)).length : 0
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to load MFA settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input.action !== "string") return NextResponse.json({ error: "Invalid MFA request." }, { status: 400 });
  try {
    const user = await accountUser();
    if (!user) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    const settings = await db.securitySettings.findUnique({
      where: { id: 1 },
      select: { authenticatorMfaEnabled: true, emailMfaEnabled: true, smsMfaEnabled: true, totpIssuer: true }
    });
    const action = input.action;
    if (action === "begin") {
      if (!settings?.authenticatorMfaEnabled) return NextResponse.json({ error: "Authenticator apps are not enabled by the site administrator." }, { status: 403 });
      if (user.mfaEnabled) return NextResponse.json({ error: "Disable your existing authenticator before enrolling a new one." }, { status: 400 });
      const secret = createTotpSecret();
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: encryptConfig(secret), mfaRecoveryCodesEncrypted: null, mfaEnrolledAt: null } });
      return NextResponse.json({ secret, issuer: settings.totpIssuer, account: user.email, otpauthUri: createOtpAuthUri(secret, user.email, settings.totpIssuer) });
    }
    if (action === "enable") {
      if (typeof input.code !== "string" || !user.mfaSecretEncrypted || !verifyTotp(decryptConfig(user.mfaSecretEncrypted), input.code)) return NextResponse.json({ error: "That authenticator code is not valid." }, { status: 400 });
      const recoveryCodes = generateRecoveryCodes();
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaRecoveryCodesEncrypted: encryptRecoveryCodes(recoveryCodes), mfaEnrolledAt: new Date() } });
      return NextResponse.json({ enabled: true, recoveryCodes });
    }
    if (action === "begin-email") {
      if (!settings?.emailMfaEnabled) return NextResponse.json({ error: "Email-code MFA is not enabled by the site administrator." }, { status: 403 });
      if (!user.emailVerifiedAt) return NextResponse.json({ error: "Verify your email address before enabling email-code MFA." }, { status: 400 });
      const challenge = await createOtpChallenge({ userId: user.id, channel: "email", purpose: "enrollment", recipient: user.email });
      try { await sendEmailMfaCode(user.email, challenge.code); } catch (error) { await db.mfaChallenge.delete({ where: { id: challenge.id } }); throw error; }
      return NextResponse.json({ expiresAt: challenge.expiresAt });
    }
    if (action === "verify-email") {
      if (typeof input.code !== "string") return NextResponse.json({ error: "Enter the email verification code." }, { status: 400 });
      const result = await verifyOtpChallenge({ userId: user.id, channel: "email", purpose: "enrollment", code: input.code });
      if (!result.valid) return NextResponse.json({ error: "That email code is invalid, expired, or locked. Request a new code." }, { status: 400 });
      await db.user.update({ where: { id: user.id }, data: { emailMfaEnabled: true } });
      return NextResponse.json({ enabled: true });
    }
    if (action === "begin-phone") {
      if (!settings?.smsMfaEnabled) return NextResponse.json({ error: "Text-message MFA is not enabled by the site administrator." }, { status: 403 });
      const phone = typeof input.phoneNumber === "string" ? normalizePhoneNumber(input.phoneNumber) : null;
      if (!phone) return NextResponse.json({ error: "Enter a valid phone number in international format, such as +15551234567." }, { status: 400 });
      if (typeof input.currentPassword !== "string" || !user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      const existingPhone = await db.user.findFirst({ where: { phoneNumber: phone, phoneVerifiedAt: { not: null }, NOT: { id: user.id } }, select: { id: true } });
      if (existingPhone) return NextResponse.json({ error: "That phone number is already enrolled on another account." }, { status: 400 });
      const challenge = await createOtpChallenge({ userId: user.id, channel: "sms", purpose: "enrollment", recipient: phone });
      try { await sendSmsMfaCode(phone, challenge.code); } catch (error) { await db.mfaChallenge.delete({ where: { id: challenge.id } }); throw error; }
      return NextResponse.json({ expiresAt: challenge.expiresAt, phoneNumber: phone });
    }
    if (action === "verify-phone") {
      if (typeof input.code !== "string") return NextResponse.json({ error: "Enter the text-message verification code." }, { status: 400 });
      const result = await verifyOtpChallenge({ userId: user.id, channel: "sms", purpose: "enrollment", code: input.code });
      if (!result.valid) return NextResponse.json({ error: "That text-message code is invalid, expired, or locked. Request a new code." }, { status: 400 });
      await db.user.update({ where: { id: user.id }, data: { phoneNumber: result.recipient, phoneVerifiedAt: new Date(), smsMfaEnabled: true } });
      return NextResponse.json({ enabled: true, phoneNumber: result.recipient });
    }
    if (action === "begin-disable-email" || action === "begin-disable-sms") {
      const channel = action === "begin-disable-email" ? "email" : "sms";
      if ((channel === "email" && !user.emailMfaEnabled) || (channel === "sms" && !user.smsMfaEnabled)) return NextResponse.json({ error: "That MFA method is not enabled." }, { status: 400 });
      if (typeof input.currentPassword !== "string" || !user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      const recipient = channel === "email" ? user.email : user.phoneNumber as string;
      const challenge = await createOtpChallenge({ userId: user.id, channel, purpose: "login", recipient });
      try {
        if (channel === "email") await sendEmailMfaCode(recipient, challenge.code);
        else await sendSmsMfaCode(recipient, challenge.code);
      } catch (error) { await db.mfaChallenge.delete({ where: { id: challenge.id } }); throw error; }
      return NextResponse.json({ expiresAt: challenge.expiresAt });
    }
    if (action === "disable-email" || action === "disable-sms") {
      if (typeof input.currentPassword !== "string" || !user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      const channel = action === "disable-email" ? "email" : "sms";
      const result = typeof input.code === "string" ? await verifyOtpChallenge({ userId: user.id, channel, purpose: "login", code: input.code }) : { valid: false };
      if (!result.valid) return NextResponse.json({ error: "Enter a valid recent MFA code to disable this method." }, { status: 400 });
      await db.user.update({ where: { id: user.id }, data: channel === "email" ? { emailMfaEnabled: false } : { smsMfaEnabled: false, phoneNumber: null, phoneVerifiedAt: null } });
      return NextResponse.json({ enabled: false });
    }
    if (action === "disable") {
      if (typeof input.currentPassword !== "string" || !user.mfaSecretEncrypted) return NextResponse.json({ error: "Enter your current password and authenticator code to disable MFA." }, { status: 400 });
      const codeValid = typeof input.code === "string" && (verifyTotp(decryptConfig(user.mfaSecretEncrypted), input.code) || consumeRecoveryCode(user.mfaRecoveryCodesEncrypted, input.code).valid);
      if (!user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash)) || !codeValid) return NextResponse.json({ error: "Password or authenticator code is incorrect." }, { status: 400 });
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaRecoveryCodesEncrypted: null, mfaEnrolledAt: null } });
      return NextResponse.json({ enabled: false });
    }
    return NextResponse.json({ error: "Unknown MFA action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    if (error instanceof Error && /configured|verification code was already sent/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "That phone number is already enrolled on another account." }, { status: 400 });
    return NextResponse.json({ error: "Unable to update MFA settings." }, { status: 500 });
  }
}
