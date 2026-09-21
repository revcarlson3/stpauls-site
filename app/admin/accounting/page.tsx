import Link from "next/link";
import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { AccountBalanceCharts } from "@/app/admin/accounting/account-balance-chart";
import { FinancialSummaryPanels } from "@/app/admin/accounting/financial-summary-panels";

export default async function AccountingDashboard() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  const settings = await ensureAccountingFoundation(church.id);
  const fiscalYearStart = new Date(Date.UTC(new Date().getUTCFullYear(), settings.fiscalYearStartMonth - 1, settings.fiscalYearStartDay));
  const [accounts, funds, bankAccounts, entries] = await Promise.all([
    db.accountingAccount.count({ where: { churchId: church.id, isActive: true } }),
    db.accountingFund.count({ where: { churchId: church.id, isActive: true } }),
    db.accountingBankAccount.findMany({ where: { churchId: church.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, openingBalance: true } }),
    db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: { gte: fiscalYearStart } }, select: { entryType: true, transactionDate: true, lines: { select: { debit: true, credit: true, bankAccountId: true, account: { select: { type: true } } } } } })
  ]);
  const balances = new Map(bankAccounts.map((account) => [account.id, Number(account.openingBalance)]));
  const monthly = Array.from({ length: 12 }, (_, monthIndex) => ({ month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(Date.UTC(2000, settings.fiscalYearStartMonth - 1 + monthIndex, 1))), income: 0, expenses: 0 }));
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.bankAccountId) balances.set(line.bankAccountId, (balances.get(line.bankAccountId) ?? 0) + Number(line.debit) - Number(line.credit));
    }
    if (entry.entryType !== "STANDARD") continue;
    const monthIndex = (entry.transactionDate.getUTCFullYear() - fiscalYearStart.getUTCFullYear()) * 12 + entry.transactionDate.getUTCMonth() - fiscalYearStart.getUTCMonth();
    if (monthIndex < 0 || monthIndex >= 12) continue;
    for (const line of entry.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (line.account.type === "INCOME") monthly[monthIndex].income += credit - debit;
      if (line.account.type === "EXPENSE") monthly[monthIndex].expenses += debit - credit;
    }
  }
  const chartAccounts = bankAccounts.map((account) => ({ ...account, balance: balances.get(account.id) ?? Number(account.openingBalance) }));
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Accounting and budget</p><h1 className="mt-2 font-serif text-4xl">Dashboard</h1><p className="mt-3 max-w-3xl text-ink/60">A safe foundation for church accounting. Posting, reconciliation, and reporting will be added in a later phase.</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><Panel label="Chart of accounts" value={accounts} href="/admin/accounting/chart-of-accounts" /><Panel label="Funds" value={funds} href="/admin/accounting/funds" /><Panel label="Bank and cash accounts" value={bankAccounts.length} href="/admin/accounting/register" /></div><section className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-2xl">Account balances</h2><p className="mt-1 text-sm text-ink/60">Recorded balance across active bank and cash accounts.</p></div><Link href="/admin/accounting/register" className="text-sm font-semibold text-coral hover:underline">Manage accounts →</Link></div><AccountBalanceCharts accounts={chartAccounts} /></section><FinancialSummaryPanels monthly={monthly} /></Container></main>;
}

function Panel({ label, value, href }: { label: string; value: number; href: string }) { return <Link href={href} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm hover:border-coral"><p className="text-sm text-ink/60">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p><p className="mt-2 text-xs font-semibold text-coral">Open →</p></Link>; }
