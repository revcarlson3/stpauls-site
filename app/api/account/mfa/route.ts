import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptConfig, encryptConfig } from "@/lib/app-config";
import { consumeRecoveryCode, createOtpAuthUri, createTotpSecret, encryptRecoveryCodes, generateRecoveryCodes, verifyTotp } from "@/lib/mfa";

async function accountUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: sign-in required.");
  return db.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, mfaEnabled: true, mfaSecretEncrypted: true, mfaRecoveryCodesEncrypted: true } });
}

export async function GET() {
  try {
    const [user, settings] = await Promise.all([
      accountUser(),
      db.securitySettings.findUnique({ where: { id: 1 }, select: { authenticatorMfaEnabled: true, totpIssuer: true } })
    ]);
    return NextResponse.json({
      available: Boolean(settings?.authenticatorMfaEnabled),
      issuer: settings?.totpIssuer ?? "St. Paul's Site",
      enabled: Boolean(user?.mfaEnabled),
      recoveryCodesRemaining: user?.mfaRecoveryCodesEncrypted ? JSON.parse(decryptConfig(user.mfaRecoveryCodesEncrypted)).length : 0
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to load authenticator settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input.action !== "string") return NextResponse.json({ error: "Invalid authenticator request." }, { status: 400 });
  try {
    const user = await accountUser();
    if (!user) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { authenticatorMfaEnabled: true, totpIssuer: true } });
    if (!settings?.authenticatorMfaEnabled) return NextResponse.json({ error: "Authenticator apps are not enabled by the site administrator." }, { status: 403 });

    if (input.action === "begin") {
      if (user.mfaEnabled) return NextResponse.json({ error: "Disable your existing authenticator before enrolling a new one." }, { status: 400 });
      const secret = createTotpSecret();
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: encryptConfig(secret), mfaRecoveryCodesEncrypted: null, mfaEnrolledAt: null } });
      return NextResponse.json({ secret, issuer: settings.totpIssuer, account: user.email, otpauthUri: createOtpAuthUri(secret, user.email, settings.totpIssuer) });
    }

    if (input.action === "enable") {
      if (typeof input.code !== "string" || !user.mfaSecretEncrypted || !verifyTotp(decryptConfig(user.mfaSecretEncrypted), input.code)) return NextResponse.json({ error: "That authenticator code is not valid." }, { status: 400 });
      const recoveryCodes = generateRecoveryCodes();
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaRecoveryCodesEncrypted: encryptRecoveryCodes(recoveryCodes), mfaEnrolledAt: new Date() } });
      return NextResponse.json({ enabled: true, recoveryCodes });
    }

    if (input.action === "disable") {
      if (typeof input.currentPassword !== "string" || !user.mfaSecretEncrypted) return NextResponse.json({ error: "Enter your current password and authenticator code to disable MFA." }, { status: 400 });
      const passwordUser = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
      const codeValid = typeof input.code === "string" && (verifyTotp(decryptConfig(user.mfaSecretEncrypted), input.code) || consumeRecoveryCode(user.mfaRecoveryCodesEncrypted, input.code).valid);
      if (!passwordUser?.passwordHash || !(await bcrypt.compare(input.currentPassword, passwordUser.passwordHash)) || !codeValid) return NextResponse.json({ error: "Password or authenticator code is incorrect." }, { status: 400 });
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaRecoveryCodesEncrypted: null, mfaEnrolledAt: null } });
      return NextResponse.json({ enabled: false });
    }
    return NextResponse.json({ error: "Unknown authenticator action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to update authenticator settings." }, { status: 500 });
  }
}
