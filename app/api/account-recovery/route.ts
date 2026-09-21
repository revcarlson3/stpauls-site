import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/account-recovery";

export async function POST(request: Request) {
  try {
    const input = await request.json();
    if (!input || typeof input.email !== "string" || !input.email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    await requestPasswordReset(input.email);
    return NextResponse.json({ message: "If an account exists for that email, a reset link has been sent." });
  } catch {
    return NextResponse.json({ error: "We could not send the reset link. Please verify the site email settings and try again." }, { status: 503 });
  }
}
