import { NextResponse } from "next/server";
import { createPendingPlatformSignup } from "@/lib/platform-signup";
export async function POST(request: Request) {
  try {
    const result = await createPendingPlatformSignup(await request.json());
    return NextResponse.json({ ...result, message: "Your onboarding request is pending verification. No payment has been taken." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup could not be started.";
    return NextResponse.json({ error: message }, { status: message.includes("already registered") ? 409 : 400 });
  }
}
