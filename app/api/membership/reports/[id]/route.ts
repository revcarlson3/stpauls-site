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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const user = await authorize();
    const existing = await db.membershipReport.findFirst({ where: { id: context.params.id, scope: "MEMBERSHIP", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const body = await request.json();
    if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "layout") && !Object.prototype.hasOwnProperty.call(body, "name")) {
      const layout = body.layout && typeof body.layout === "object" ? body.layout : {};
      const report = await db.membershipReport.update({ where: { id: existing.id }, data: { layout } });
      return NextResponse.json({ report });
    }
    const data = reportData(body);
    if (!body || typeof body !== "object" || !Object.prototype.hasOwnProperty.call(body, "layout")) data.layout = existing.layout && typeof existing.layout === "object" ? existing.layout : {};
    const report = await db.membershipReport.update({ where: { id: existing.id }, data });
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "Unable to update report." }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const user = await authorize();
    const existing = await db.membershipReport.findFirst({ where: { id: context.params.id, scope: "MEMBERSHIP", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    await db.membershipReport.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete report." }, { status: 400 });
  }
}
