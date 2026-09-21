import { NextResponse } from "next/server";
import { listSelectedSiteSupportTickets } from "@/lib/global-admin-support";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    return NextResponse.json({ tickets: await listSelectedSiteSupportTickets(status) });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to load support tickets." }, { status: 500 });
  }
}
