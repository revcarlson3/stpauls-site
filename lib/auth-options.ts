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
        if (!user?.passwordHash || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;
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
