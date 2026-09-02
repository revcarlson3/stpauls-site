import { NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/invitations";

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.token !== "string" || typeof input.password !== "string") return NextResponse.json({ error: "Invitation token and password are required." }, { status: 400 });
  try { await acceptInvitation(input.token, input.password); return NextResponse.json({ message: "Account created. You can now sign in." }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to accept invitation." }, { status: 400 }); }
}
