import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EVENT_REPORT_TYPES, EVENT_REPORT_COLUMNS, type EventReportColumn } from "@/lib/event-reporting";
import { authorizeReportModule } from "@/lib/reporting";

function normalize(input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const reportType = EVENT_REPORT_TYPES.some((item) => item.value === value.reportType) ? String(value.reportType) : "";
  const columns = Array.isArray(value.columns) ? value.columns.filter((item): item is EventReportColumn => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).key === "string" && typeof (item as Record<string, unknown>).label === "string") : EVENT_REPORT_COLUMNS;
  return {
    scope: "EVENT",
    name: typeof value.name === "string" ? value.name.trim().slice(0, 120) : "",
    description: typeof value.description === "string" ? value.description.trim().slice(0, 500) : null,
    reportType, criteria: value.criteria && typeof value.criteria === "object" ? value.criteria : {}, columns,
    sort: Array.isArray(value.sort) ? value.sort : [], grouping: value.grouping && typeof value.grouping === "object" ? value.grouping : {},
    layout: value.layout && typeof value.layout === "object" ? value.layout : {}, striped: value.striped !== false,
    visibility: value.visibility === "EVENT_MANAGERS" ? "EVENT_MANAGERS" : "PRIVATE"
  };
}
export async function GET(request: Request) {
  try {
    const scope = await authorizeReportModule({ module: "events", churchId: new URL(request.url).searchParams.get("churchId") || undefined });
    const { user } = scope;
    const reports = await db.membershipReport.findMany({ where: { churchId: scope.churchId, scope: "EVENT", OR: [{ createdById: user.id }, { visibility: "EVENT_MANAGERS" }] }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, description: true, reportType: true, criteria: true, columns: true, sort: true, grouping: true, layout: true, striped: true, visibility: true, updatedAt: true } });
    return NextResponse.json({ reports });
  } catch { return NextResponse.json({ error: "Unable to load event reports." }, { status: 403 }); }
}
export async function POST(request: Request) {
  try {
    const data = normalize(await request.json());
    const scope = await authorizeReportModule({ module: "events", churchId: new URL(request.url).searchParams.get("churchId") || undefined });
    const { user } = scope;
    if (!data.name || !data.reportType) return NextResponse.json({ error: "Report name and type are required." }, { status: 400 });
    const report = await db.membershipReport.create({ data: { ...data, churchId: scope.churchId, createdById: user.id } });
    return NextResponse.json({ report }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to save event report." }, { status: 400 }); }
}
