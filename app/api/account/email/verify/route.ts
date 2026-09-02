import { NextResponse } from "next/server";
import { confirmEmailChange } from "@/lib/email-change";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Verification token is required." }, { status: 400 });
  try {
    await confirmEmailChange(token);
    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) throw new Error("NEXTAUTH_URL is not configured.");
    return NextResponse.redirect(new URL("/account?emailChanged=1", baseUrl));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Email change link")) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
