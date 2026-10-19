import { NextResponse } from "next/server";
import { createPublicSiteSessionToken } from "@/lib/public-site-bridge";

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "The sign-in handoff is missing." }, { status: 400 });

  const sessionToken = await createPublicSiteSessionToken(token, request.headers.get("host"));
  if (!sessionToken) return NextResponse.json({ error: "The sign-in handoff is invalid or expired." }, { status: 401 });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set({
    name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
  });
  return response;
}
