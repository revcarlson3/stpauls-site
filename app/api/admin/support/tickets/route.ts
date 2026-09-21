import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/tenant";
import { GET as listTickets, POST as createTicket } from "@/app/api/support/tickets/route";

export async function GET(request: Request) {
  try { await requirePlatformAdmin(); return listTickets(request); }
  catch { return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try { await requirePlatformAdmin(); return createTicket(request); }
  catch { return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 }); }
}
