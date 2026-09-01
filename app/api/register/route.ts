import { NextResponse } from "next/server";
import { registerUser } from "@/lib/registration";

export async function POST(request: Request) {
  const input = await request.json();
  try {
    const result = await registerUser(input);
    return NextResponse.json({ message: "If the address can be registered, a verification email has been sent.", ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "Email delivery is not configured." || error.message === "Invalid registration details.")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "This email address is already registered." }, { status: 409 });
    }
    throw error;
  }
}

