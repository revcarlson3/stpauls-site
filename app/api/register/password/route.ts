import { NextResponse } from "next/server";
import { setPassword } from "@/lib/registration";

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.token !== "string" || typeof input.password !== "string") {
    return NextResponse.json({ error: "A verification token and password are required." }, { status: 400 });
  }
  try {
    await setPassword(input.token, input.password);
    return NextResponse.json({ message: "Password set. You can now sign in." });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Verification link") || error.message.startsWith("Password"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

