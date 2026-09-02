import { NextResponse } from "next/server";
import { listPendingInvitations } from "@/lib/invitations";

export async function GET() {
  try {
    return NextResponse.json(await listPendingInvitations());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    throw error;
  }
}
