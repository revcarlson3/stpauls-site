import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/registration";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Verification token is required." }, { status: 400 });
  try {
    await verifyEmail(token);
    return NextResponse.json({ message: "Email verified. Password setup can now be completed." });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Verification link")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

