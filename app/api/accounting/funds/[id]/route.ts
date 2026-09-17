import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const context = await requireCurrentChurch();
  await ensureAccountingFoundation(context.church.id);
  return context.church;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const church = await authorize();
    const existing = await db.accountingFund.findFirst({ where: { id: params.id, churchId: church.id } });
    if (!existing) return NextResponse.json({ error: "Fund not found." }, { status: 404 });
    const input = await request.json();
    const data: { code?: string; name?: string; description?: string | null; isActive?: boolean; sortOrder?: number } = {};
    if (typeof input?.code === "string") data.code = input.code.trim().slice(0, 40).toUpperCase();
    if (typeof input?.name === "string") data.name = input.name.trim().slice(0, 120);
    if (typeof input?.description === "string" || input?.description === null) data.description = typeof input.description === "string" ? input.description.trim().slice(0, 500) : null;
    if (typeof input?.isActive === "boolean") data.isActive = input.isActive;
    if (typeof input?.sortOrder === "number" && Number.isInteger(input.sortOrder) && input.sortOrder >= 0) data.sortOrder = input.sortOrder;
    if (data.code === "") return NextResponse.json({ error: "Code cannot be empty." }, { status: 400 });
    if (data.name === "") return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    const fund = await db.accountingFund.update({ where: { id: existing.id }, data });
    return NextResponse.json({ fund });
  } catch { return NextResponse.json({ error: "Unable to update fund." }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const church = await authorize();
    const existing = await db.accountingFund.findFirst({ where: { id: params.id, churchId: church.id }, include: { _count: { select: { journalLines: true } } } });
    if (!existing) return NextResponse.json({ error: "Fund not found." }, { status: 404 });
    if (existing._count.journalLines > 0) return NextResponse.json({ error: "Funds used by journal entries cannot be deleted. Disable the fund instead." }, { status: 409 });
    await db.accountingFund.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete fund." }, { status: 400 }); }
}
