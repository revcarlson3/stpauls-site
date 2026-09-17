import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { normalizeCriteria } from "@/lib/membership-audiences";
import { DEFAULT_MEMBERSHIP_REPORT_COLUMNS, MEMBERSHIP_REPORT_TYPES, type MembershipReportColumn, type MembershipReportSort } from "@/lib/membership-reporting";

const reportTypes = MEMBERSHIP_REPORT_TYPES.map((report) => report.value);

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return user;
}

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

export async function GET() {
  try {
    const user = await authorize();
    const reports = await db.membershipReport.findMany({
      where: { scope: "MEMBERSHIP", OR: [{ createdById: user.id }, { visibility: "MEMBERSHIP_MANAGERS" }] },
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
    const user = await authorize();
    const data = reportData(await request.json());
    if (!data.name || !data.reportType) return NextResponse.json({ error: "Report name and type are required." }, { status: 400 });
    const report = await db.membershipReport.create({ data: { ...data, scope: "MEMBERSHIP", createdById: user.id } });
    return NextResponse.json({ report }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create report." }, { status: 400 });
  }
}
