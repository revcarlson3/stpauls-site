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

export async function GET() {
  try {
    const church = await authorize();
    const funds = await db.accountingFund.findMany({ where: { churchId: church.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
    return NextResponse.json({ funds });
  } catch { return NextResponse.json({ error: "Unable to load funds." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json();
    const code = typeof input?.code === "string" ? input.code.trim().slice(0, 40).toUpperCase() : "";
    const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : "";
    if (!code || !name) return NextResponse.json({ error: "Code and name are required." }, { status: 400 });
    const last = await db.accountingFund.findFirst({ where: { churchId: church.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const fund = await db.accountingFund.create({ data: { churchId: church.id, code, name, description: typeof input?.description === "string" ? input.description.trim().slice(0, 500) : null, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    return NextResponse.json({ fund }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to create fund." }, { status: 400 }); }
}
