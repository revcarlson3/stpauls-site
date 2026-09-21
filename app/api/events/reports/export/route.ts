import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    const reports = await db.membershipReport.findMany({ where: { churchId: scope.church.id, scope: "EVENT", OR: [{ createdById: user.id }, { visibility: "EVENT_MANAGERS" }] }, orderBy: { name: "asc" } });
    return new NextResponse(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), reports }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=event-reports.json" } });
  } catch { return NextResponse.json({ error: "Unable to export reports." }, { status: 403 }); }
}
