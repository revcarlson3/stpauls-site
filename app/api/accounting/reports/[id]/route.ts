import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeAccountingReport } from "@/lib/accounting-reporting";
import { authorizeReportModule } from "@/lib/reporting";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = await request.json();
    const scope = await authorizeReportModule({ module: "accounting", churchId: typeof input?.churchId === "string" ? input.churchId : undefined });
    const { user } = scope;
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, churchId: scope.churchId, scope: "ACCOUNTING", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const data = normalizeAccountingReport(input);
    const report = await db.membershipReport.update({ where: { id: existing.id }, data });
    return NextResponse.json({ report });
  } catch { return NextResponse.json({ error: "Unable to update accounting report." }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const scope = await authorizeReportModule({ module: "accounting", churchId: new URL(_request.url).searchParams.get("churchId") || undefined });
    const { user } = scope;
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, churchId: scope.churchId, scope: "ACCOUNTING", createdById: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    await db.membershipReport.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete accounting report." }, { status: 400 }); }
}
