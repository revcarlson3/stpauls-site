import { NextResponse } from "next/server";
import { auditActivityTypes, listAuditLogs } from "@/lib/audit";

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? undefined;
  if (type && !auditActivityTypes.includes(type as (typeof auditActivityTypes)[number])) return NextResponse.json({ error: "Invalid activity type." }, { status: 400 });
  try {
    return NextResponse.json(await listAuditLogs(type));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load activity." }, { status: 500 });
  }
}
