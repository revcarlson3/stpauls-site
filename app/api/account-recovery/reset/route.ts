import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/account-recovery";

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.token !== "string" || typeof input.password !== "string") return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  try {
    await resetPassword(input.token, input.password);
    return NextResponse.json({ message: "Password updated." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reset password." }, { status: 400 });
  }
}
