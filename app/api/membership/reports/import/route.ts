import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { normalizeCriteria } from "@/lib/membership-audiences";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const body = await request.json();
    const reports = Array.isArray(body?.reports) ? body.reports : [];
    if (!reports.length || reports.length > 100) return NextResponse.json({ error: "A report file must contain between 1 and 100 reports." }, { status: 400 });
    const created = [];
    for (const input of reports) {
      if (!input || typeof input.name !== "string" || typeof input.reportType !== "string") continue;
      created.push(await db.membershipReport.create({ data: { name: `${input.name} (Imported)`.slice(0, 120), description: typeof input.description === "string" ? input.description.slice(0, 500) : null, reportType: input.reportType, criteria: normalizeCriteria(input.criteria), columns: Array.isArray(input.columns) ? input.columns : [], sort: Array.isArray(input.sort) ? input.sort : [], grouping: input.grouping && typeof input.grouping === "object" ? input.grouping : {}, layout: {}, striped: input.striped !== false, visibility: "PRIVATE", createdById: user.id } }));
    }
    return NextResponse.json({ reports: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to import reports." }, { status: 400 });
  }
}
