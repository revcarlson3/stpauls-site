import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPageAccessToken, pageAccessCookieName } from "@/lib/page-access";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { pageId?: unknown; password?: unknown } | null;
  if (typeof input?.pageId !== "string" || typeof input.password !== "string" || input.password.length > 128) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${client}:${input.pageId}`;
  const now = Date.now();
  if (attempts.size > 1000) {
    attempts.forEach((value, attemptKey) => {
      if (value.resetAt <= now || attempts.size > 1000) attempts.delete(attemptKey);
    });
  }
  const rate = attempts.get(key);
  if (rate && rate.resetAt > now && rate.count >= 10) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  attempts.set(key, rate && rate.resetAt > now ? { ...rate, count: rate.count + 1 } : { count: 1, resetAt: now + 15 * 60 * 1000 });

  const page = await db.page.findFirst({
    where: { id: input.pageId, OR: [{ status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] }, { status: "DRAFT", publishAt: { lte: new Date() } }] },
    select: { id: true, passwordHash: true }
  });
  if (!page?.passwordHash || !(await bcrypt.compare(input.password, page.passwordHash))) {
    return NextResponse.json({ error: "The password is incorrect." }, { status: 401 });
  }
  const token = createPageAccessToken(page.id, page.passwordHash);
  if (!token) return NextResponse.json({ error: "Page access is not configured." }, { status: 503 });
  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(pageAccessCookieName(page.id), token.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token.maxAge
  });
  return response;
}
