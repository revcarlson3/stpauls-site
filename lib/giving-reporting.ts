export type GivingReportType =
  | "giving-report"
  | "categories"
  | "contribution-statements"
  | "pledge-statements"
  | "custom";

export type GivingReportColumn = { key: string; label: string };

export const GIVING_REPORT_TYPES: Array<{ value: GivingReportType; label: string; description: string }> = [
  { value: "giving-report", label: "Giving Report", description: "A giving-focused summary by category and contribution." },
  { value: "categories", label: "Categories", description: "Active categories enabled for giving." },
  { value: "contribution-statements", label: "Contribution Statements", description: "Official tax statements with household details, deductible totals, and printable/PDF output." },
  { value: "pledge-statements", label: "Pledge Statements", description: "Coming later." },
  { value: "custom", label: "Custom report", description: "Build a standard giving data-table report." },
];

export const GIVING_REPORT_COLUMNS: GivingReportColumn[] = [
  { key: "batchDate", label: "Batch date" },
  { key: "envelopeNumber", label: "Envelope number" },
  { key: "memberName", label: "Member" },
  { key: "amount", label: "Amount" },
  { key: "categoryCode", label: "Category code" },
  { key: "categoryName", label: "Category" },
  { key: "paymentType", label: "Payment type" },
  { key: "pledgeCampaign", label: "Pledge campaign" },
  { key: "memo", label: "Memo" },
];

export function givingReportPreset(type: GivingReportType) {
  if (type === "categories") {
    return {
      columns: [
        { key: "code", label: "Code" },
        { key: "name", label: "Category" },
        { key: "parentCode", label: "Parent code" },
      ],
      sortKey: "code",
      sortDirection: "asc" as const,
    };
  }
  return {
    columns: type === "giving-report" ? GIVING_REPORT_COLUMNS.filter((column) => ["categoryCode", "categoryName", "amount"].includes(column.key)) : GIVING_REPORT_COLUMNS,
    sortKey: type === "giving-report" ? "categoryCode" : "batchDate",
    sortDirection: "desc" as const,
  };
}

export function givingReportTypeLabel(type: string) {
  return GIVING_REPORT_TYPES.find((item) => item.value === type)?.label ?? type;
}
