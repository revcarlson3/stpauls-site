import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { EVENT_REPORT_TYPES, EVENT_REPORT_COLUMNS } from "@/lib/event-reporting";

async function authorize() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return user;
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, scope: "EVENT", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const input = await request.json();
    if (Object.prototype.hasOwnProperty.call(input, "layout") && !Object.prototype.hasOwnProperty.call(input, "name")) {
      const report = await db.membershipReport.update({ where: { id: existing.id }, data: { layout: input.layout && typeof input.layout === "object" ? input.layout : {} } });
      return NextResponse.json({ report });
    }
    const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const reportType = EVENT_REPORT_TYPES.some((item) => item.value === value.reportType) ? String(value.reportType) : existing.reportType;
    const columns = Array.isArray(value.columns) ? value.columns : EVENT_REPORT_COLUMNS;
    const report = await db.membershipReport.update({ where: { id: existing.id }, data: { name: typeof value.name === "string" ? value.name.trim().slice(0, 120) : existing.name, description: typeof value.description === "string" ? value.description.trim().slice(0, 500) : null, reportType, criteria: value.criteria && typeof value.criteria === "object" ? value.criteria : {}, columns, sort: Array.isArray(value.sort) ? value.sort : [], grouping: value.grouping && typeof value.grouping === "object" ? value.grouping : {}, layout: value.layout && typeof value.layout === "object" ? value.layout : (existing.layout || {}), visibility: value.visibility === "EVENT_MANAGERS" ? "EVENT_MANAGERS" : "PRIVATE" } });
    return NextResponse.json({ report });
  } catch { return NextResponse.json({ error: "Unable to update event report." }, { status: 400 }); }
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, scope: "EVENT", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    await db.membershipReport.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete event report." }, { status: 400 }); }
}
