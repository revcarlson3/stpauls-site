import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { normalizeAccountingReport } from "@/lib/accounting-reporting";
import { authorizeReportModule } from "@/lib/reporting";

async function authorize(churchId?: string) {
  const scope = await authorizeReportModule({ module: "accounting", churchId });
  const church = await db.church.findUnique({ where: { id: scope.churchId } });
  if (!church) throw new Error("The requested church is unavailable.");
  await ensureAccountingFoundation(church.id);
  return { user: scope.user, church };
}

export async function GET(request: Request) {
  try {
    const scope = await authorize(new URL(request.url).searchParams.get("churchId") || undefined);
    const { user } = scope;
    const reports = await db.membershipReport.findMany({ where: { churchId: scope.church.id, scope: "ACCOUNTING", createdById: user.id }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ reports });
  } catch { return NextResponse.json({ error: "Unable to load accounting reports." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const scope = await authorize(typeof input?.churchId === "string" ? input.churchId : undefined);
    const { user } = scope;
    const data = normalizeAccountingReport(input);
    if (!data.name || !data.reportType) return NextResponse.json({ error: "Report name and type are required." }, { status: 400 });
    const report = await db.membershipReport.create({ data: { ...data, churchId: scope.church.id, scope: "ACCOUNTING", createdById: user.id } });
    return NextResponse.json({ report }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to create accounting report." }, { status: 400 }); }
}
