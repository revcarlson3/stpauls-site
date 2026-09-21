import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCriteria } from "@/lib/membership-audiences";
import { DEFAULT_MEMBERSHIP_REPORT_COLUMNS, MEMBERSHIP_REPORT_TYPES, type MembershipReportColumn, type MembershipReportSort } from "@/lib/membership-reporting";
import { authorizeReportModule } from "@/lib/reporting";

const reportTypes = MEMBERSHIP_REPORT_TYPES.map((report) => report.value);

function reportData(input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) : "";
  const reportType = typeof value.reportType === "string" && reportTypes.includes(value.reportType as typeof reportTypes[number]) ? value.reportType : "";
  const description = typeof value.description === "string" ? value.description.trim().slice(0, 500) : null;
  const visibility = value.visibility === "MEMBERSHIP_MANAGERS" ? "MEMBERSHIP_MANAGERS" : "PRIVATE";
  const columns = Array.isArray(value.columns) ? value.columns.filter((column): column is MembershipReportColumn => Boolean(column) && typeof column === "object" && typeof (column as Record<string, unknown>).key === "string" && typeof (column as Record<string, unknown>).label === "string") : DEFAULT_MEMBERSHIP_REPORT_COLUMNS;
  const sort = Array.isArray(value.sort) ? value.sort.filter((item): item is MembershipReportSort => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).key === "string" && ["asc", "desc"].includes(String((item as Record<string, unknown>).direction))) : [];
  const layout = value.layout && typeof value.layout === "object" ? value.layout : {};
  return { name, reportType, description, visibility, criteria: normalizeCriteria(value.criteria), columns, sort, grouping: value.grouping && typeof value.grouping === "object" ? value.grouping : {}, layout, striped: value.striped !== false };
}

export async function GET(request: Request) {
  try {
    const scope = await authorizeReportModule({ module: "membership", churchId: new URL(request.url).searchParams.get("churchId") || undefined });
    const { user } = scope;
    const reports = await db.membershipReport.findMany({
      where: { churchId: scope.churchId, scope: "MEMBERSHIP", OR: [{ createdById: user.id }, { visibility: "MEMBERSHIP_MANAGERS" }] },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, name: true, description: true, reportType: true, criteria: true, columns: true, sort: true, grouping: true, layout: true, striped: true, visibility: true, createdAt: true, updatedAt: true }
    });
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "Unable to load reports." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const data = reportData(input);
    const scope = await authorizeReportModule({ module: "membership", churchId: typeof input?.churchId === "string" ? input.churchId : undefined });
    const { user } = scope;
    if (!data.name || !data.reportType) return NextResponse.json({ error: "Report name and type are required." }, { status: 400 });
    const report = await db.membershipReport.create({ data: { ...data, churchId: scope.churchId, scope: "MEMBERSHIP", createdById: user.id } });
    return NextResponse.json({ report }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create report." }, { status: 400 });
  }
}
