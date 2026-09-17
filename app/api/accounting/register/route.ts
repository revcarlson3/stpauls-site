import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { buildEntry } from "@/lib/accounting-register";
import { ensureAccountingContact } from "@/lib/accounting-contacts";


async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  await ensureAccountingFoundation(church.id);
  return church;
}


export async function GET() {
  try {
    const church = await authorize();
    const entries = await db.accountingJournalEntry.findMany({
      where: { churchId: church.id },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        bankAccount: { select: { id: true, name: true } },
        lines: { include: { account: { select: { id: true, code: true, name: true } }, bankAccount: { select: { id: true, name: true } }, fund: { select: { id: true, name: true } } } }
      }
    });
    const transactions = entries.map((entry) => {
      const bankLine = entry.lines.find((line) => line.bankAccountId);
      const offsetLine = entry.lines.find((line) => !line.bankAccountId);
      const amount = entry.entryType === "STANDARD" && bankLine ? Number(bankLine.debit) - Number(bankLine.credit) : Number(entry.lines.find((line) => Number(line.debit) > 0)?.debit ?? 0);
      return {
        id: entry.id, date: entry.transactionDate.toISOString(), description: entry.description, reference: entry.reference, paymentMethod: entry.paymentMethod, transactionType: entry.transactionType, entryType: entry.entryType, amount: entry.entryType === "STANDARD" ? amount : Math.abs(amount),
        bankAccountId: entry.bankAccount?.id ?? bankLine?.bankAccount?.id ?? "", bankAccount: entry.bankAccount?.name ?? bankLine?.bankAccount?.name ?? "Unassigned",
        destinationBankAccountId: entry.entryType === "BANK_TRANSFER" ? entry.lines.find((line) => line.bankAccountId && line.bankAccountId !== (entry.bankAccount?.id ?? bankLine?.bankAccount?.id))?.bankAccount?.id ?? "" : "",
        category: offsetLine ? `${offsetLine.account.code} · ${offsetLine.account.name}` : entry.entryType === "ACCOUNT_TRANSFER" ? entry.lines.map((line) => `${line.account.code} · ${line.account.name}`).join(" → ") : "Transfer",
        accountId: entry.entryType === "ACCOUNT_TRANSFER" ? entry.lines.find((line) => Number(line.credit) > 0)?.account.id ?? "" : offsetLine?.account.id ?? "",
        destinationAccountId: entry.entryType === "ACCOUNT_TRANSFER" ? entry.lines.find((line) => Number(line.debit) > 0)?.account.id ?? "" : "",
        fund: offsetLine?.fund?.name ?? null,
        fundId: entry.entryType === "FUND_TRANSFER" ? entry.lines.find((line) => Number(line.credit) > 0)?.fund?.id ?? "" : offsetLine?.fund?.id ?? "",
        destinationFundId: entry.entryType === "FUND_TRANSFER" ? entry.lines.find((line) => Number(line.debit) > 0)?.fund?.id ?? "" : "",
        allocations: entry.entryType === "STANDARD" ? entry.lines.filter((line) => !line.bankAccountId).map((line) => ({ accountId: line.account.id, fundId: line.fund?.id ?? "", amount: Number(line.debit) + Number(line.credit) })) : []
      };
    });
    return NextResponse.json({ transactions });
  } catch { return NextResponse.json({ error: "Unable to load the register." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json();
    const description = await ensureAccountingContact(church.id, input);
    if (description) input.description = description;
    const entry = await buildEntry(input, church.id);
    if (!entry) return NextResponse.json({ error: "Enter valid transaction or transfer details." }, { status: 400 });
    const created = await db.accountingJournalEntry.create({ data: { churchId: church.id, bankAccountId: entry.bankAccountId, transactionDate: entry.transactionDate, description: entry.description, reference: entry.reference || null, paymentMethod: entry.paymentMethod, transactionType: entry.transactionType || "CREDIT", entryType: entry.entryType, status: "POSTED", lines: { create: entry.lines } }, select: { id: true } });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to post the register entry." }, { status: 400 }); }
}
