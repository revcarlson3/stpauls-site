import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await db.user.findUnique({ where: { email: credentials.email.toLowerCase().trim() } });
        if (!user?.passwordHash || !user.isActive) return null;
        const now = new Date();
        const settings = await db.securitySettings.findUnique({ where: { id: 1 } }) ?? { loginProtectionEnabled: true, maxFailedAttempts: 5, lockoutMinutes: 15 };
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
        await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, loginWindowStartedAt: null, lockedUntil: null } });
        const access = await db.groupPermission.findUnique({ where: { groupId_permission: { groupId: user.groupId ?? "", permission: "ACCESS_ADMIN" } } });
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
        token.exp = Math.floor(Date.now() / 1000) + (user.rememberMe ? REMEMBERED_SESSION_SECONDS : STANDARD_SESSION_SECONDS);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.canAccessAdmin = token.canAccessAdmin;
      }
      return session;
    }
  }
};
