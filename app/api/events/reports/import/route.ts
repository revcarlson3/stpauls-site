import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { EVENT_REPORT_TYPES, EVENT_REPORT_COLUMNS } from "@/lib/event-reporting";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const body = await request.json();
    const reports = Array.isArray(body?.reports) ? body.reports : [];
    if (!reports.length || reports.length > 100) return NextResponse.json({ error: "A report file must contain between 1 and 100 reports." }, { status: 400 });
    const created = [];
    for (const input of reports) {
      if (!input || typeof input.name !== "string" || !EVENT_REPORT_TYPES.some((type) => type.value === input.reportType)) continue;
      created.push(await db.membershipReport.create({ data: { scope: "EVENT", name: `${input.name} (Imported)`.slice(0, 120), description: typeof input.description === "string" ? input.description.slice(0, 500) : null, reportType: input.reportType, criteria: input.criteria && typeof input.criteria === "object" ? input.criteria : {}, columns: Array.isArray(input.columns) ? input.columns : EVENT_REPORT_COLUMNS, sort: Array.isArray(input.sort) ? input.sort : [], grouping: input.grouping && typeof input.grouping === "object" ? input.grouping : {}, layout: {}, striped: input.striped !== false, visibility: "PRIVATE", createdById: user.id } }));
    }
    return NextResponse.json({ reports: created }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to import reports." }, { status: 400 }); }
}
