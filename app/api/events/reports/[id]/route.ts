import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EVENT_REPORT_TYPES, EVENT_REPORT_COLUMNS } from "@/lib/event-reporting";
import { authorizeReportModule } from "@/lib/reporting";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = await request.json();
    const scope = await authorizeReportModule({ module: "events", churchId: typeof input?.churchId === "string" ? input.churchId : undefined });
    const { user } = scope;
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, churchId: scope.churchId, scope: "EVENT", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
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
    const scope = await authorizeReportModule({ module: "events", churchId: new URL(_.url).searchParams.get("churchId") || undefined });
    const { user } = scope;
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, churchId: scope.churchId, scope: "EVENT", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    await db.membershipReport.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete event report." }, { status: 400 }); }
}
