import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { normalizeAccountingReport } from "@/lib/accounting-reporting";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  return user;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, scope: "ACCOUNTING", createdById: user.id } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const data = normalizeAccountingReport(await request.json());
    const report = await db.membershipReport.update({ where: { id: existing.id }, data });
    return NextResponse.json({ report });
  } catch { return NextResponse.json({ error: "Unable to update accounting report." }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const existing = await db.membershipReport.findFirst({ where: { id: params.id, scope: "ACCOUNTING", createdById: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    await db.membershipReport.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete accounting report." }, { status: 400 }); }
}
