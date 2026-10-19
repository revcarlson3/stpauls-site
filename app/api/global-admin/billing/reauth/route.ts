import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptConfig } from "@/lib/app-config";
import { consumeRecoveryCode, verifyTotp } from "@/lib/mfa";
import { buildGlobalAuditDetails, createGlobalAdminReauthToken, GLOBAL_ADMIN_REAUTH_COOKIE, requireGlobalAdmin } from "@/lib/global-admin";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await requireGlobalAdmin();
    const input = await request.json();
    const code = typeof input.code === "string" ? input.code : "";
    const user = await db.user.findUnique({ where: { id: context.user.id }, select: { mfaSecretEncrypted: true, mfaRecoveryCodesEncrypted: true, sessionVersion: true } });
    let valid = Boolean(user?.mfaSecretEncrypted && verifyTotp(decryptConfig(user.mfaSecretEncrypted), code));
    if (!valid && user) {
      const recovery = consumeRecoveryCode(user.mfaRecoveryCodesEncrypted, code);
      if (recovery.valid) {
        const consumed = await db.user.updateMany({ where: { id: context.user.id, mfaRecoveryCodesEncrypted: user.mfaRecoveryCodesEncrypted }, data: { mfaRecoveryCodesEncrypted: recovery.remaining } });
        valid = consumed.count === 1;
      }
    }
    if (!valid || !user) return NextResponse.json({ error: "That verification code was not accepted." }, { status: 400 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(GLOBAL_ADMIN_REAUTH_COOKIE, createGlobalAdminReauthToken(context.user.id, user.sessionVersion), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 15 * 60, path: "/" });
    await logAudit({ activityType: "billing-provider-reauthenticated", summary: "Reauthenticated for billing provider configuration.", actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: "platform", targetType: "billing-provider-configuration" }) });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify the authentication code." }, { status: 403 });
  }
}
