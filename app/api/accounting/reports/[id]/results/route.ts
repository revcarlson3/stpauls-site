import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAccountingFoundation, parentCodeForAccount } from "@/lib/accounting";
import { ACCOUNTING_REPORT_COLUMNS, accountingReportTypeLabel, reportPreset, type AccountingReportCriteria, type AccountingReportType } from "@/lib/accounting-reporting";
import { authorizeReportExecution, authorizeReportModule } from "@/lib/reporting";

function dateRange(criteria: AccountingReportCriteria) {
  const from = criteria.dateFrom ? new Date(`${criteria.dateFrom}T00:00:00.000Z`) : undefined;
  const to = criteria.dateTo ? new Date(`${criteria.dateTo}T23:59:59.999Z`) : undefined;
  return { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) };
}

function accountIsParent(account: { id: string; parentId: string | null }, accounts: { id: string; parentId: string | null }[]) {
  return accounts.some((candidate) => candidate.parentId === account.id);
}

function accountDepth(accountId: string, accountsById: Map<string, { parentId: string | null }>) {
  let depth = 0;
  let current = accountsById.get(accountId);
  while (current?.parentId && depth < 20) {
    depth += 1;
    current = accountsById.get(current.parentId);
  }
  return depth;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const requestedChurchId = url.searchParams.get("churchId") || undefined;
    const scope = await authorizeReportModule({ module: "accounting", churchId: requestedChurchId });
    const currentUser = scope.user;
    const church = { id: scope.churchId };
    await ensureAccountingFoundation(church.id);
    let report = await db.membershipReport.findFirst({ where: { id: params.id, churchId: scope.churchId, scope: "ACCOUNTING", createdById: currentUser.id } });
    if (params.id === "preview") {
      const definition = new URL(request.url).searchParams.get("definition");
      if (!definition) return NextResponse.json({ error: "Report definition is required." }, { status: 400 });
      report = JSON.parse(definition) as typeof report;
    }
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const { user } = await authorizeReportExecution({ module: "accounting", reportType: report.reportType, churchId: requestedChurchId });
    const type = report.reportType as AccountingReportType;
    const criteria = (report.criteria ?? {}) as AccountingReportCriteria;
    const preset = reportPreset(type);
    const configuredColumns = (Array.isArray(report.columns) && report.columns.length ? report.columns : preset.columns) as typeof preset.columns;
    const columns = type === "treasurer"
      ? [...configuredColumns, ...preset.columns.filter((column) => !configuredColumns.some((configured) => configured.key === column.key))]
      : configuredColumns;
    const rows: Array<{ id: string; [key: string]: string | number | boolean }> = [];
    if (type === "chart-of-accounts") {
      const accounts = await db.accountingAccount.findMany({ where: { churchId: church.id }, orderBy: { code: "asc" } });
      accounts.forEach((account) => rows.push({ id: account.id, code: account.code, account: account.name, type: account.type, active: account.isActive ? "Yes" : "No" }));
    } else if (type === "funds") {
      const funds = await db.accountingFund.findMany({ where: { churchId: church.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
      funds.forEach((fund) => rows.push({ id: fund.id, code: fund.code, account: fund.name, active: fund.isActive ? "Yes" : "No" }));
    } else if (type === "account-balances") {
      const accounts = await db.accountingBankAccount.findMany({ where: { churchId: church.id }, orderBy: { name: "asc" } });
      const entries = await db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria) }, select: { lines: { select: { bankAccountId: true, debit: true, credit: true } } } });
      const balances = new Map(accounts.map((account) => [account.id, Number(account.openingBalance)]));
      entries.forEach((entry) => entry.lines.forEach((line) => { if (line.bankAccountId) balances.set(line.bankAccountId, (balances.get(line.bankAccountId) ?? 0) + Number(line.debit) - Number(line.credit)); }));
      accounts.forEach((account) => rows.push({ id: account.id, account: account.name, balance: balances.get(account.id) ?? 0 }));
    } else if (type === "budget" || type === "treasurer") {
      const accounts = await db.accountingAccount.findMany({ where: { churchId: church.id }, select: { id: true, code: true, name: true, parentId: true, isActive: true } });
      const accountsByCode = new Map(accounts.map((account) => [account.code, account]));
      const normalizedAccounts = accounts.map((account) => { const derivedParentCode = parentCodeForAccount(account.code); return { ...account, parentId: account.parentId ?? (derivedParentCode ? accountsByCode.get(derivedParentCode)?.id ?? null : null) }; });
      const accountsById = new Map(normalizedAccounts.map((account) => [account.id, account]));
      const budget = await db.accountingBudget.findFirst({ where: { churchId: church.id, ...(criteria.fiscalYear ? { fiscalYear: criteria.fiscalYear } : {}) }, orderBy: { fiscalYear: "desc" }, include: { items: { include: { account: true } } } });
      const actuals = new Map<string, number>();
      if (type === "treasurer") {
        const entries = await db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria) }, select: { lines: { select: { accountId: true, debit: true, credit: true, account: { select: { type: true, code: true, name: true, isActive: true } } } } } });
        entries.forEach((entry) => entry.lines.forEach((line) => { if (line.account.type === "EXPENSE") actuals.set(line.accountId, (actuals.get(line.accountId) ?? 0) + Number(line.debit) - Number(line.credit)); }));
      }
      const detailItems = (budget?.items ?? []).filter((item) => {
        const account = accountsById.get(item.accountId);
        return account?.isActive !== false && !account?.code.startsWith("4") && !account?.code.startsWith("7") && (account ? !accountIsParent(account, normalizedAccounts) : true);
      });
      const parentIds = new Set<string>();
      detailItems.forEach((item) => { let current = accountsById.get(item.accountId); while (current?.parentId) { parentIds.add(current.parentId); current = accountsById.get(current.parentId); } });
      const headersByParent = new Map<string, typeof accounts[number]>();
      normalizedAccounts.filter((account) => account.isActive && parentIds.has(account.id)).forEach((parent) => headersByParent.set(parent.id, parent));
      const emittedHeaders = new Set<string>();
      let unbudgetedTotal = 0;
      const sectionParentId = (accountId: string) => {
        let current = accountsById.get(accountId);
        let topLevel: string | undefined;
        while (current?.parentId) {
          topLevel = current.parentId;
          current = accountsById.get(current.parentId);
        }
        return topLevel;
      };
      const sectionTotals = new Map<string, { budget: number; actual: number }>();
      detailItems.forEach((item) => {
        const sectionId = sectionParentId(item.accountId);
        if (!sectionId) return;
        const totals = sectionTotals.get(sectionId) ?? { budget: 0, actual: 0 };
        totals.budget += Number(item.annualAmount);
        totals.actual += actuals.get(item.accountId) ?? 0;
        sectionTotals.set(sectionId, totals);
      });
      let currentSectionId: string | undefined;
      const addSectionTotal = (sectionId: string | undefined) => {
        if (type !== "treasurer" || !sectionId) return;
        const parent = headersByParent.get(sectionId);
        const totals = sectionTotals.get(sectionId);
        if (!parent || !totals) return;
        rows.push({ id: `subtotal-${parent.id}`, code: "", account: "Total", budget: totals.budget, isSubtotal: true, actual: totals.actual, variance: totals.budget - totals.actual });
      };
      detailItems.sort((left, right) => left.account.code.localeCompare(right.account.code)).forEach((item) => {
        const amount = Number(item.annualAmount);
        const actual = actuals.get(item.accountId) ?? 0;
        const sectionId = sectionParentId(item.accountId);
        if (currentSectionId && sectionId !== currentSectionId) addSectionTotal(currentSectionId);
        currentSectionId = sectionId;
        const parentChain: typeof accounts = [];
        let parentId = item.account.parentId;
        while (parentId) {
          const parent = headersByParent.get(parentId);
          if (!parent) break;
          parentChain.unshift(parent);
          parentId = parent.parentId;
        }
        parentChain.forEach((parent) => {
          if (emittedHeaders.has(parent.id)) return;
          emittedHeaders.add(parent.id);
          rows.push({ id: `parent-${parent.id}`, code: parent.code, account: `${"\u00a0\u00a0".repeat(accountDepth(parent.id, accountsById))}${parent.name}`, budget: "", isGroup: true, ...(type === "treasurer" ? { actual: "", variance: "" } : {}) });
        });
        rows.push({ id: item.id, code: item.account.code, account: `${"\u00a0\u00a0".repeat(accountDepth(item.accountId, accountsById))}${item.account.name}`, budget: amount, ...(type === "treasurer" ? { actual, variance: amount - actual } : {}) });
      });
      addSectionTotal(currentSectionId);
      if (type === "treasurer") {
        const restrictedEntries = await db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria) }, select: { lines: { where: { account: { type: "EXPENSE", code: { startsWith: "7" }, isActive: true } }, select: { accountId: true, debit: true, credit: true, account: { select: { code: true, name: true, parentId: true } } } } } });
        const restricted = new Map<string, { code: string; name: string; amount: number }>();
        restrictedEntries.forEach((entry) => entry.lines.forEach((line) => {
          const current = restricted.get(line.accountId) ?? { code: line.account.code, name: line.account.name, amount: 0 };
          current.amount += Number(line.debit) - Number(line.credit);
          restricted.set(line.accountId, current);
        }));
        if (restricted.size) {
          rows.push({ id: "restricted-category", code: "70000", account: "Restricted Expenses", budget: "", isGroup: true, actual: "", variance: "" });
          restricted.forEach((item, accountId) => rows.push({ id: `restricted-${accountId}`, code: item.code, account: `\u00a0\u00a0${item.name}`, budget: "", actual: item.amount, variance: item.amount }));
          const restrictedTotal = Array.from(restricted.values()).reduce((sum, item) => sum + item.amount, 0);
          unbudgetedTotal = restrictedTotal;
          rows.push({ id: "restricted-total", code: "", account: "Total", budget: 0, actual: restrictedTotal, variance: restrictedTotal, isSubtotal: true });
        }
      }
      if (type === "treasurer") {
        const totalBudget = detailItems.reduce((sum, item) => sum + Number(item.annualAmount), 0);
        const totalActual = detailItems.reduce((sum, item) => sum + (actuals.get(item.accountId) ?? 0), 0) + unbudgetedTotal;
        rows.push({ id: "grand-total", code: "", account: "Total", budget: totalBudget, isTotal: true, actual: totalActual, variance: totalBudget - totalActual });
      }
    } else if (type === "journal") {
      const entries = await db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria) }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }], include: { lines: { include: { account: true, fund: true } } } });
      entries.forEach((entry) => entry.lines.filter((line) => (!criteria.accountId || line.accountId === criteria.accountId) && (!criteria.fundId || line.fundId === criteria.fundId)).forEach((line) => rows.push({
        id: line.id,
        date: entry.transactionDate.toISOString().slice(0, 10),
        code: line.account.code,
        account: line.account.name,
        fund: line.fund?.name ?? "—",
        description: entry.description,
        reference: entry.reference ?? "—",
        entryType: entry.entryType,
        memo: line.memo ?? "—",
        debit: Number(line.debit),
        credit: Number(line.credit)
      })));
    } else {
      const entries = await db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria), lines: { some: { account: { type: "EXPENSE" }, ...(criteria.accountId ? { accountId: criteria.accountId } : {}), ...(criteria.fundId ? { fundId: criteria.fundId } : {}) } } }, orderBy: { transactionDate: "desc" }, include: { lines: { include: { account: true, fund: true } } } });
      entries.forEach((entry) => entry.lines.filter((line) => line.account.type === "EXPENSE" && (!criteria.accountId || line.accountId === criteria.accountId) && (!criteria.fundId || line.fundId === criteria.fundId)).forEach((line) => rows.push({ id: line.id, date: entry.transactionDate.toISOString().slice(0, 10), code: line.account.code, account: line.account.name, fund: line.fund?.name ?? "—", description: entry.description, reference: entry.reference ?? "—", debit: Number(line.debit), credit: Number(line.credit), amount: Number(line.debit) - Number(line.credit) })));
    }
    const requestedGrouping = typeof (report.grouping as { key?: unknown })?.key === "string" ? String((report.grouping as { key: string }).key) : "";
    const groupingCounts = requestedGrouping ? Object.entries(rows.reduce<Record<string, number>>((counts, row) => { const value = String(row[requestedGrouping] ?? "—"); counts[value] = (counts[value] ?? 0) + 1; return counts; }, {})).map(([label, count]) => ({ label, count })) : [];
    const detailRows = rows.filter((row) => row.isGroup !== true && row.isSubtotal !== true && row.isTotal !== true);
    let statement: { income: { label: string; amount: number }[]; expenses: { label: string; amount: number }[]; accounts: { label: string; amount: number }[]; totalIncome: number; totalExpenses: number; net: number; accountsTotal: number } | undefined;
    if (type === "treasurer") {
      const [statementEntries, bankAccounts] = await Promise.all([
        db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria) }, select: { lines: { select: { debit: true, credit: true, account: { select: { name: true, type: true } } } } } }),
        db.accountingBankAccount.findMany({ where: { churchId: church.id }, orderBy: { name: "asc" }, select: { id: true, name: true, openingBalance: true } })
      ]);
      const incomeMap = new Map<string, number>();
      const expenseMap = new Map<string, number>();
      statementEntries.forEach((entry) => entry.lines.forEach((line) => {
        const amount = Number(line.credit) - Number(line.debit);
        if (line.account.type === "INCOME") incomeMap.set(line.account.name, (incomeMap.get(line.account.name) ?? 0) + amount);
        if (line.account.type === "EXPENSE") expenseMap.set(line.account.name, (expenseMap.get(line.account.name) ?? 0) + -amount);
      }));
      const accountBalances = new Map(bankAccounts.map((account) => [account.id, Number(account.openingBalance)]));
      const balanceEntries = await db.accountingJournalEntry.findMany({ where: { churchId: church.id, transactionDate: dateRange(criteria) }, select: { lines: { select: { bankAccountId: true, debit: true, credit: true } } } });
      balanceEntries.forEach((entry) => entry.lines.forEach((line) => { if (line.bankAccountId) accountBalances.set(line.bankAccountId, (accountBalances.get(line.bankAccountId) ?? 0) + Number(line.debit) - Number(line.credit)); }));
      const income = Array.from(incomeMap, ([label, amount]) => ({ label, amount })).sort((left, right) => left.label.localeCompare(right.label));
      const expenses = Array.from(expenseMap, ([label, amount]) => ({ label, amount })).sort((left, right) => left.label.localeCompare(right.label));
      const accounts = bankAccounts.map((account) => ({ label: account.name, amount: accountBalances.get(account.id) ?? 0 }));
      const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
      statement = { income, expenses, accounts, totalIncome, totalExpenses, net: totalIncome - totalExpenses, accountsTotal: accounts.reduce((sum, item) => sum + item.amount, 0) };
    }
    const reportMeta = { id: report.id, name: typeof report.name === "string" && report.name.trim() ? report.name : accountingReportTypeLabel(type), reportType: report.reportType, columns, grouping: requestedGrouping, groupingCounts, dateFrom: criteria.dateFrom ?? "", dateTo: criteria.dateTo ?? "", chart: Boolean((criteria as Record<string, unknown>).chart), chartOnly: Boolean((criteria as Record<string, unknown>).chartOnly), chartType: String((criteria as Record<string, unknown>).chartType ?? "bar"), pivotRow: String(criteria.pivotRow ?? ""), pivotColumn: String(criteria.pivotColumn ?? ""), pivotValue: String(criteria.pivotValue ?? "amount"), pivotAggregation: String(criteria.pivotAggregation ?? "sum"), summary: { total: detailRows.length, amount: detailRows.reduce((sum, row) => sum + Number(row.amount ?? row.actual ?? row.balance ?? 0), 0) }, statement, layout: report.layout ?? {}, generatedAt: new Date().toISOString(), generatedBy: user.name };
    return NextResponse.json({ report: reportMeta, rows, total: rows.length });
  } catch { return NextResponse.json({ error: "Unable to run accounting report." }, { status: 400 }); }
}
