import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/account-recovery";

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.email !== "string" || !input.email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await requestPasswordReset(input.email);
  return NextResponse.json({ message: "If an account exists for that email, a reset link has been sent." });
}
