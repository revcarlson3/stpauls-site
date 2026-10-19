const PLAN_INTERVALS = new Set(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]);

export function normalizePlanEditorState(plan: Record<string, unknown>) {
  const normalized = typeof plan.interval === "string" ? plan.interval.trim().toUpperCase().replace(/-/g, "_") : "";
  return { ...plan, interval: PLAN_INTERVALS.has(normalized) ? normalized : "MONTHLY", price: plan.price ?? plan.monthlyPrice ?? "" };
}
