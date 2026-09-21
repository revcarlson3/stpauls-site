import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureStandardBudget } from "@/lib/budget";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  return (await requireCurrentChurch()).church;
}

function serialize(budget: any) {
  return {
    ...budget,
    startDate: budget.startDate.toISOString(),
    endDate: budget.endDate.toISOString(),
    items: budget.items.map((item: any) => ({
      id: item.id, accountId: item.accountId, isEnabled: item.isEnabled, code: item.account.code,
      name: item.account.name, parentId: item.account.parentId, annualAmount: Number(item.annualAmount),
      months: Array.from({ length: 12 }, (_, index) => Number(item[`month${String(index + 1).padStart(2, "0")}`]))
    }))
  };
}

export async function GET(request: Request) {
  try {
    const church = await authorize();
    const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getUTCFullYear();
    const budget = await db.accountingBudget.findUnique({
      where: { churchId_name_fiscalYear: { churchId: church.id, name: "Standard", fiscalYear: year } },
      include: { items: { include: { account: true }, orderBy: { account: { code: "asc" } } } }
    });
    return NextResponse.json({ budget: budget ? serialize(budget) : null });
  } catch { return NextResponse.json({ error: "Unable to load the budget." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json().catch(() => ({}));
    const year = Number(input?.fiscalYear) || new Date().getUTCFullYear();
    const copyFromFiscalYear = input?.copyFromPreviousYear ? year - 1 : undefined;
    const budget = await ensureStandardBudget(church.id, year, copyFromFiscalYear);
    return NextResponse.json({ budget: serialize(budget) }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to create the budget." }, { status: 400 }); }
}
