import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const COOKIE_NAME = "mfa-trusted-device";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const account = await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } });
  if (!account) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { mfaChallengePolicy: true, trustedDeviceDays: true } });
  if (settings?.mfaChallengePolicy !== "trusted-device") return NextResponse.json({ error: "Trusted devices are not enabled." }, { status: 400 });
  const expiresAt = Math.floor(Date.now() / 1000) + (settings.trustedDeviceDays ?? 30) * 86400;
  const value = `${user.id}.${account.sessionVersion}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "development-only-config-key").update(value).digest("base64url");
  cookies().set(COOKIE_NAME, `${value}.${signature}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: (settings.trustedDeviceDays ?? 30) * 86400 });
  return NextResponse.json({ trusted: true });
}
