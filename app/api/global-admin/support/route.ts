import { NextResponse } from "next/server";
import { listSelectedSiteSupportTickets } from "@/lib/global-admin-support";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    return NextResponse.json({ tickets: await listSelectedSiteSupportTickets(status, true) });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load support tickets." }, { status: 500 });
  }
}
