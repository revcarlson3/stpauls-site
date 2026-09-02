import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { verifyCaptcha } from "@/lib/captcha";
import { consumeRecoveryCode, verifyTotp } from "@/lib/mfa";
import { decryptConfig } from "@/lib/app-config";

const REMEMBERED_SESSION_SECONDS = 60 * 24 * 60 * 60;
const STANDARD_SESSION_SECONDS = 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: REMEMBERED_SESSION_SECONDS },
  jwt: { maxAge: REMEMBERED_SESSION_SECONDS },
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember me", type: "text" }
        ,captchaToken: { label: "Captcha token", type: "text" }
        ,captchaAnswer: { label: "Captcha answer", type: "text" }
        ,mfaCode: { label: "Authenticator code", type: "text" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await db.user.findUnique({ where: { email: credentials.email.toLowerCase().trim() } });
        const settings = await db.securitySettings.findUnique({ where: { id: 1 } }) ?? { loginProtectionEnabled: true, maxFailedAttempts: 5, lockoutMinutes: 15, captchaMode: "off", authenticatorMfaEnabled: false, mfaChallengePolicy: "every-login" };
        if (settings.captchaMode === "challenge" && !verifyCaptcha(credentials.captchaToken, credentials.captchaAnswer)) return null;
        if (!user?.passwordHash || !user.isActive) return null;
        const now = new Date();
        if (settings.loginProtectionEnabled && user.lockedUntil && user.lockedUntil > now) return null;
        const windowMs = settings.lockoutMinutes * 60 * 1000;
        const windowExpired = !user.loginWindowStartedAt || now.getTime() - user.loginWindowStartedAt.getTime() >= windowMs;
        const failedAttempts = windowExpired ? 0 : user.failedLoginAttempts;
        if (!(await bcrypt.compare(credentials.password, user.passwordHash))) {
          if (!settings.loginProtectionEnabled) return null;
          const nextAttempts = failedAttempts + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: nextAttempts,
              loginWindowStartedAt: windowExpired ? now : user.loginWindowStartedAt,
              lockedUntil: nextAttempts >= settings.maxFailedAttempts ? new Date(now.getTime() + windowMs) : null
            }
          });
          return null;
        }
        const access = await db.groupPermission.findUnique({ where: { groupId_permission: { groupId: user.groupId ?? "", permission: "ACCESS_ADMIN" } } });
        const trusted = settings.mfaChallengePolicy === "trusted-device" && await isTrustedDevice(req.headers?.cookie, user.id);
        const mfaRequired = Boolean(settings.authenticatorMfaEnabled && user.mfaEnabled && user.mfaSecretEncrypted && !trusted);
        if (mfaRequired) {
          const mfaCode = typeof credentials.mfaCode === "string" ? credentials.mfaCode : "";
          if (!mfaCode) return { id: user.id, name: user.name, email: user.email, role: user.role, canAccessAdmin: Boolean(access), rememberMe: credentials.rememberMe === "true", mfaPending: true, mfaPendingUserId: user.id };
          let valid = verifyTotp(decryptConfig(user.mfaSecretEncrypted), mfaCode);
          if (!valid) {
            const recovery = consumeRecoveryCode(user.mfaRecoveryCodesEncrypted, mfaCode);
            valid = recovery.valid;
            if (recovery.valid) {
              const consumed = await db.user.updateMany({ where: { id: user.id, mfaRecoveryCodesEncrypted: user.mfaRecoveryCodesEncrypted }, data: { mfaRecoveryCodesEncrypted: recovery.remaining } });
              valid = consumed.count === 1;
            }
          }
          if (!valid) {
            if (settings.loginProtectionEnabled) {
              const nextAttempts = failedAttempts + 1;
              await db.user.update({
                where: { id: user.id },
                data: {
                  failedLoginAttempts: nextAttempts,
                  loginWindowStartedAt: windowExpired ? now : user.loginWindowStartedAt,
                  lockedUntil: nextAttempts >= settings.maxFailedAttempts ? new Date(now.getTime() + windowMs) : null
                }
              });
            }
            return null;
          }
        }
        await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, loginWindowStartedAt: null, lockedUntil: null } });
        return { id: user.id, name: user.name, email: user.email, role: user.role, canAccessAdmin: Boolean(access), rememberMe: credentials.rememberMe === "true" };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.canAccessAdmin = Boolean(user.canAccessAdmin);
        token.mfaPending = Boolean(user.mfaPending);
        token.mfaPendingUserId = user.mfaPendingUserId;
        token.exp = Math.floor(Date.now() / 1000) + (user.rememberMe ? REMEMBERED_SESSION_SECONDS : STANDARD_SESSION_SECONDS);
        token.sessionVersion = (await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } }))?.sessionVersion ?? 0;
      } else if (token.id) {
        const current = await db.user.findUnique({ where: { id: token.id }, select: { sessionVersion: true, isActive: true } });
        if (current && token.sessionVersion === undefined) token.sessionVersion = current.sessionVersion;
        token.invalid = !current?.isActive || current.sessionVersion !== token.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.canAccessAdmin = token.canAccessAdmin;
        session.user.mfaPending = token.mfaPending;
        session.user.mfaPendingUserId = token.mfaPendingUserId;
        if (token.invalid || token.mfaPending) session.user.id = "";
      }
      return session;
    }
  }
};

async function isTrustedDevice(cookieHeader: string | string[] | undefined, userId: string) {
  if (!cookieHeader || Array.isArray(cookieHeader)) return false;
  const raw = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("mfa-trusted-device="))?.slice("mfa-trusted-device=".length);
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 4) return false;
  const [cookieUserId, sessionVersion, expiresAt, signature] = parts;
  const payload = `${cookieUserId}.${sessionVersion}.${expiresAt}`;
  const expected = crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "development-only-config-key").update(payload).digest("base64url");
  if (cookieUserId !== userId || !/^\d+$/.test(sessionVersion) || Number(expiresAt) <= Math.floor(Date.now() / 1000) || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const current = await db.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return current?.sessionVersion === Number(sessionVersion);
}
