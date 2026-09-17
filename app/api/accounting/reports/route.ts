import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { normalizeAccountingReport } from "@/lib/accounting-reporting";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  await ensureAccountingFoundation(church.id);
  return { user, church };
}

export async function GET() {
  try {
    const { user } = await authorize();
    const reports = await db.membershipReport.findMany({ where: { scope: "ACCOUNTING", createdById: user.id }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ reports });
  } catch { return NextResponse.json({ error: "Unable to load accounting reports." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const { user } = await authorize();
    const data = normalizeAccountingReport(await request.json());
    if (!data.name || !data.reportType) return NextResponse.json({ error: "Report name and type are required." }, { status: 400 });
    const report = await db.membershipReport.create({ data: { ...data, scope: "ACCOUNTING", createdById: user.id } });
    return NextResponse.json({ report }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to create accounting report." }, { status: 400 }); }
}
