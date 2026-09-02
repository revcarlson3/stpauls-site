import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const REMEMBERED_SESSION_SECONDS = 60 * 24 * 60 * 60;
const STANDARD_SESSION_SECONDS = 24 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

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
        if (!user?.passwordHash) return null;
        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) return null;
        const windowExpired = !user.loginWindowStartedAt || now.getTime() - user.loginWindowStartedAt.getTime() >= LOGIN_WINDOW_MS;
        const failedAttempts = windowExpired ? 0 : user.failedLoginAttempts;
        if (!(await bcrypt.compare(credentials.password, user.passwordHash))) {
          const nextAttempts = failedAttempts + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: nextAttempts,
              loginWindowStartedAt: windowExpired ? now : user.loginWindowStartedAt,
              lockedUntil: nextAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(now.getTime() + LOGIN_LOCKOUT_MS) : null
            }
          });
          return null;
        }
        await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, loginWindowStartedAt: null, lockedUntil: null } });
        return { id: user.id, name: user.name, email: user.email, role: user.role, rememberMe: credentials.rememberMe === "true" };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.exp = Math.floor(Date.now() / 1000) + (user.rememberMe ? REMEMBERED_SESSION_SECONDS : STANDARD_SESSION_SECONDS);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  }
};
