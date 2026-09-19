import { NextResponse } from "next/server";
import { revokeSelectedChurchUserSessions } from "@/lib/global-admin-users";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({}));
  if (!input || typeof input.userId !== "string") return NextResponse.json({ error: "A user is required." }, { status: 400 });
  try { await revokeSelectedChurchUserSessions(input.userId); return NextResponse.json({ ok: true }); }
  catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("selected user")) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Unable to revoke sessions." }, { status: 500 });
  }
}
