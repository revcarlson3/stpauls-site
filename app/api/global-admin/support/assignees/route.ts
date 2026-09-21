import { NextResponse } from "next/server";
import { listSupportAssignees } from "@/lib/global-admin-support";

export async function GET() {
  try {
    return NextResponse.json({ assignees: await listSupportAssignees() });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to load support assignees." }, { status: 500 });
  }
}
