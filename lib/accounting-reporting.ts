export const ACCOUNTING_REPORT_TYPES = [
  { value: "budget", label: "Budget" },
  { value: "treasurer", label: "Treasurer's report" },
  { value: "chart-of-accounts", label: "Chart of accounts" },
  { value: "funds", label: "Funds" },
  { value: "account-balances", label: "Account balances" },
  { value: "expenses", label: "Expense report" },
  { value: "journal", label: "Journal report" },
  { value: "custom", label: "Custom report" }
] as const;

export type AccountingReportType = typeof ACCOUNTING_REPORT_TYPES[number]["value"];
export type AccountingReportColumn = { key: string; label: string };
export type AccountingReportCriteria = { fiscalYear?: number; dateFrom?: string; dateTo?: string; accountId?: string; fundId?: string; groupBy?: string; pivotRow?: string; pivotColumn?: string; pivotValue?: string; pivotAggregation?: "sum" | "count" | "average" };
export type AccountingReportLayout = { order?: string[]; widths?: Record<string, number>; visibility?: Record<string, boolean> };

export function accountingReportTypeLabel(type: string) {
  return ACCOUNTING_REPORT_TYPES.find((item) => item.value === type)?.label ?? "Accounting report";
}

export const ACCOUNTING_REPORT_COLUMNS: AccountingReportColumn[] = [
  { key: "date", label: "Date" }, { key: "code", label: "Account code" }, { key: "account", label: "Account" },
  { key: "fund", label: "Fund" }, { key: "description", label: "Description" }, { key: "reference", label: "Reference" }, { key: "entryType", label: "Entry type" }, { key: "memo", label: "Memo" },
  { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }, { key: "amount", label: "Amount" },
  { key: "budget", label: "Budget" }, { key: "actual", label: "Actual" }, { key: "variance", label: "Variance" },
  { key: "type", label: "Type" }, { key: "active", label: "Active" }, { key: "balance", label: "Balance" }
];

export function reportPreset(type: AccountingReportType) {
  const presets: Record<AccountingReportType, { columns: string[]; sort: string; direction: "asc" | "desc"; groupBy: string }> = {
    budget: { columns: ["code", "account", "budget"], sort: "code", direction: "asc", groupBy: "" },
    treasurer: { columns: ["code", "account", "budget", "actual", "variance"], sort: "code", direction: "asc", groupBy: "account" },
    "chart-of-accounts": { columns: ["code", "account", "type", "active"], sort: "code", direction: "asc", groupBy: "type" },
    funds: { columns: ["code", "account", "active"], sort: "code", direction: "asc", groupBy: "" },
    "account-balances": { columns: ["account", "balance"], sort: "account", direction: "desc", groupBy: "" },
    expenses: { columns: ["date", "code", "account", "fund", "description", "amount"], sort: "date", direction: "desc", groupBy: "account" },
    journal: { columns: ["date", "code", "account", "fund", "description", "reference", "entryType", "memo", "debit", "credit"], sort: "date", direction: "desc", groupBy: "date" },
    custom: { columns: ["date", "code", "account", "fund", "description", "amount"], sort: "date", direction: "desc", groupBy: "" }
  };
  const preset = presets[type];
  return { ...preset, columns: preset.columns.map((key) => ACCOUNTING_REPORT_COLUMNS.find((column) => column.key === key)).filter((column): column is AccountingReportColumn => Boolean(column)) };
}

export function normalizeAccountingReport(input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const reportType = typeof value.reportType === "string" && ACCOUNTING_REPORT_TYPES.some((type) => type.value === value.reportType) ? value.reportType as AccountingReportType : "";
  const preset = reportPreset(reportType || "custom");
  const criteriaValue = value.criteria && typeof value.criteria === "object" ? value.criteria as Record<string, unknown> : {};
  const criteria: AccountingReportCriteria = {};
  for (const key of ["fiscalYear", "dateFrom", "dateTo", "accountId", "fundId", "groupBy", "pivotRow", "pivotColumn", "pivotValue", "pivotAggregation"]) {
    if (key === "fiscalYear" && typeof criteriaValue[key] === "number") criteria.fiscalYear = criteriaValue[key];
    if (key !== "fiscalYear" && typeof criteriaValue[key] === "string" && criteriaValue[key]) criteria[key as keyof AccountingReportCriteria] = criteriaValue[key] as never;
  }
  const columns = Array.isArray(value.columns) ? value.columns.filter((column): column is AccountingReportColumn => Boolean(column) && typeof column === "object" && typeof (column as Record<string, unknown>).key === "string" && typeof (column as Record<string, unknown>).label === "string") : preset.columns;
  return {
    name: typeof value.name === "string" ? value.name.trim().slice(0, 120) : "",
    description: typeof value.description === "string" ? value.description.trim().slice(0, 500) : null,
    reportType: reportType || "custom",
    criteria,
    columns: columns.length ? columns : preset.columns,
    sort: [{ key: typeof value.sortKey === "string" ? value.sortKey : preset.sort, direction: value.sortDirection === "desc" ? "desc" : preset.direction }],
    grouping: { key: typeof value.groupBy === "string" ? value.groupBy : preset.groupBy },
    layout: value.layout && typeof value.layout === "object" ? value.layout : {},
    visibility: "PRIVATE",
    striped: true
  };
}
