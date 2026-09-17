import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  return (await requireCurrentChurch()).church;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const church = await authorize();
    const budget = await db.accountingBudget.findFirst({ where: { id: params.id, churchId: church.id } });
    if (!budget) return NextResponse.json({ error: "Budget not found." }, { status: 404 });
    const input = await request.json();
    if (input?.entryMode === "MONTHLY" || input?.entryMode === "ANNUAL") {
      const items = await db.accountingBudgetItem.findMany({ where: { budgetId: budget.id } });
      await db.$transaction(async (transaction) => {
        for (const item of items) {
          const data = input.entryMode === "MONTHLY"
            ? { month01: Number(item.annualAmount) / 12, month02: Number(item.annualAmount) / 12, month03: Number(item.annualAmount) / 12, month04: Number(item.annualAmount) / 12, month05: Number(item.annualAmount) / 12, month06: Number(item.annualAmount) / 12, month07: Number(item.annualAmount) / 12, month08: Number(item.annualAmount) / 12, month09: Number(item.annualAmount) / 12, month10: Number(item.annualAmount) / 12, month11: Number(item.annualAmount) / 12, month12: Number(item.annualAmount) / 12 }
            : { annualAmount: [item.month01, item.month02, item.month03, item.month04, item.month05, item.month06, item.month07, item.month08, item.month09, item.month10, item.month11, item.month12].reduce((sum, value) => sum + Number(value), 0) };
          await transaction.accountingBudgetItem.update({ where: { id: item.id }, data });
        }
        await transaction.accountingBudget.update({ where: { id: budget.id }, data: { entryMode: input.entryMode } });
      });
      const updatedBudget = await db.accountingBudget.findUnique({ where: { id: budget.id } });
      return NextResponse.json({ budget: updatedBudget });
    }
    const item = await db.accountingBudgetItem.findFirst({ where: { id: input?.itemId, budgetId: budget.id, budget: { churchId: church.id } }, include: { account: true } });
    if (!item) return NextResponse.json({ error: "Budget item not found." }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (typeof input.isEnabled === "boolean") {
      const items = await db.accountingBudgetItem.findMany({ where: { budgetId: budget.id }, select: { id: true, accountId: true, account: { select: { parentId: true } } } });
      const descendants = new Set<string>([item.accountId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of items) {
          if (candidate.account.parentId && descendants.has(candidate.account.parentId) && !descendants.has(candidate.accountId)) {
            descendants.add(candidate.accountId);
            changed = true;
          }
        }
      }
      await db.accountingBudgetItem.updateMany({ where: { budgetId: budget.id, accountId: { in: Array.from(descendants) } }, data: { isEnabled: input.isEnabled } });
    }
    if (typeof input.annualAmount === "number" && Number.isFinite(input.annualAmount) && input.annualAmount >= 0) data.annualAmount = input.annualAmount;
    if (Array.isArray(input.months) && input.months.length === 12 && input.months.every((v: unknown) => typeof v === "number" && Number.isFinite(v) && (v as number) >= 0)) {
      input.months.forEach((value: number, index: number) => { data[`month${String(index + 1).padStart(2, "0")}`] = value; });
    }
    const updated = await db.accountingBudgetItem.update({ where: { id: item.id }, data });
    return NextResponse.json({ item: updated });
  } catch { return NextResponse.json({ error: "Unable to update the budget item." }, { status: 400 }); }
}
