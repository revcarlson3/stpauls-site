import { NextResponse } from "next/server";
import { createInvitation } from "@/lib/invitations";

export async function POST(request: Request) {
  const input = await request.json();
  if (!input || typeof input.email !== "string" || typeof input.name !== "string" || !["viewer", "editor", "admin"].includes(input.role) || (input.groupId !== null && typeof input.groupId !== "string")) return NextResponse.json({ error: "Invalid invitation details." }, { status: 400 });
  try { await createInvitation(input); return NextResponse.json({ message: "Invitation sent." }, { status: 201 }); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 }); if (error instanceof Error && ["Email delivery", "Invalid", "Provide"].some((prefix) => error.message.startsWith(prefix))) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ error: "Unable to send invitation." }, { status: 500 }); }
}
