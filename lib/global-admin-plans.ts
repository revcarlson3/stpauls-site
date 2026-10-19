import { BillingInterval, PlanEntitlementMode, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { sanitizeAnnouncementHtml } from "@/lib/announcement-content";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";
import { logAudit } from "@/lib/audit";

const MODES = new Set(Object.values(PlanEntitlementMode));
const MODULE_SLUGS = new Set<string>([...MODULES.map((module) => module.slug), "custom-domains"]);
const PLAN_INTERVALS = new Set<BillingInterval>(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]);


export function validatePlanInput(input: Record<string, unknown>) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!name || name.length > 120) throw new Error("Plan name is required and must be at most 120 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new Error("Plan slug must use lowercase letters, numbers, and hyphens.");
  const price = Number(input.price);
  const hasAtMostTwoDecimals = (value: number) => Math.abs(value - Math.round(value * 100) / 100) < 1e-9;
  if (!Number.isFinite(price) || price <= 0 || !hasAtMostTwoDecimals(price)) throw new Error("Price must be a positive amount with at most two decimals.");
  const intervalInput = typeof input.interval === "string" ? input.interval.trim().toUpperCase().replace(/-/g, "_") : "";
  if (!PLAN_INTERVALS.has(intervalInput as BillingInterval)) throw new Error("Choose a monthly, quarterly, semi-annual, or annual billing interval.");
  const interval = intervalInput as BillingInterval;
  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "USD";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code.");
  const trialDays = input.trialDays === "" || input.trialDays === undefined || input.trialDays === null ? null : Number(input.trialDays);
  if (trialDays !== null && (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365)) throw new Error("Trial days must be a whole number from 0 to 365.");
  const entitlements = Array.isArray(input.entitlements) ? input.entitlements : [];
  const normalized = entitlements.map((entry) => {
    const value = entry as Record<string, unknown>;
    const moduleSlug = typeof value.moduleSlug === "string" ? value.moduleSlug : "";
    const mode = typeof value.mode === "string" ? value.mode : "DISABLED";
    const addOnPrice = value.addOnPrice === "" || value.addOnPrice === undefined || value.addOnPrice === null ? null : Number(value.addOnPrice);
    const addOnMonthly = value.addOnMonthly === "" || value.addOnMonthly === undefined || value.addOnMonthly === null ? null : Number(value.addOnMonthly);
    const addOnAnnual = value.addOnAnnual === "" || value.addOnAnnual === undefined || value.addOnAnnual === null ? null : Number(value.addOnAnnual);
    if (!MODULE_SLUGS.has(moduleSlug) || !MODES.has(mode as PlanEntitlementMode)) throw new Error("Plan contains an unknown entitlement.");
    if (mode === "PAID_ADD_ON") {
      if (addOnPrice !== null) {
        if (!Number.isFinite(addOnPrice) || addOnPrice < 0 || !hasAtMostTwoDecimals(addOnPrice)) throw new Error("Paid add-on prices must be non-negative amounts with at most two decimals.");
        return { moduleSlug, mode: mode as PlanEntitlementMode, addOnMonthly: addOnPrice, addOnAnnual: addOnPrice };
      }
      if (addOnMonthly !== null && addOnAnnual === null) {
        if (!Number.isFinite(addOnMonthly) || addOnMonthly < 0 || !hasAtMostTwoDecimals(addOnMonthly)) throw new Error("Paid add-on prices must be non-negative amounts with at most two decimals.");
        return { moduleSlug, mode: mode as PlanEntitlementMode, addOnMonthly, addOnAnnual: addOnMonthly };
      }
      if (addOnAnnual !== null && addOnMonthly === null) {
        if (!Number.isFinite(addOnAnnual) || addOnAnnual < 0 || !hasAtMostTwoDecimals(addOnAnnual)) throw new Error("Paid add-on prices must be non-negative amounts with at most two decimals.");
        return { moduleSlug, mode: mode as PlanEntitlementMode, addOnMonthly: addOnAnnual, addOnAnnual };
      }
      if (addOnMonthly === null || addOnAnnual === null) throw new Error("Paid add-ons require a non-negative price for the selected billing interval.");
      if ((!Number.isFinite(addOnMonthly) || addOnMonthly! < 0) || (!Number.isFinite(addOnAnnual) || addOnAnnual! < 0)) throw new Error("Paid add-ons require non-negative monthly and annual prices.");
    }
    return { moduleSlug, mode: mode as PlanEntitlementMode, addOnMonthly, addOnAnnual };
  });
  if (new Set(normalized.map((entry) => entry.moduleSlug)).size !== normalized.length) throw new Error("Each plan entitlement may be listed only once.");
  const description = typeof input.description === "string" ? sanitizeAnnouncementHtml(input.description.slice(0, 20000)) : null;
  return { name, slug, description, price: new Prisma.Decimal(price.toFixed(2)), interval: interval as BillingInterval, currency, trialDays, isActive: input.isActive !== false, sortOrder: Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0, stripeEnabled: input.stripeEnabled !== false, paypalEnabled: input.paypalEnabled !== false, entitlements: normalized };
}

const planSelect = { id: true, name: true, slug: true, description: true, monthlyPrice: true, annualPrice: true, price: true, interval: true, currency: true, trialDays: true, stripeEnabled: true, paypalEnabled: true, isActive: true, sortOrder: true, createdAt: true, updatedAt: true, entitlements: { orderBy: { moduleSlug: "asc" as const } }, _count: { select: { subscriptions: true } } };
export async function listGlobalPlans() { await requireGlobalAdmin(); return db.subscriptionPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: planSelect }); }
export async function listSelectablePlans() { return db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: planSelect }); }
export async function createGlobalPlan(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true }); const values = validatePlanInput(input);
  const plan = await db.$transaction(async (tx) => { const created = await tx.subscriptionPlan.create({ data: { name: values.name, slug: values.slug, description: values.description, price: values.price, interval: values.interval, monthlyPrice: values.price, annualPrice: values.price, currency: values.currency, trialDays: values.trialDays, isActive: values.isActive, sortOrder: values.sortOrder, stripeEnabled: values.stripeEnabled, paypalEnabled: values.paypalEnabled }, select: { id: true, name: true, slug: true } }); if (values.entitlements.length) await tx.subscriptionPlanEntitlement.createMany({ data: values.entitlements.map((entry) => ({ ...entry, planId: created.id })) }); return created; });
  await auditPlan(context.user.id, plan.id, "create", plan.name); return plan;
}
export async function updateGlobalPlan(id: string, input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true }); const values = validatePlanInput(input);
  const plan = await db.$transaction(async (tx) => { const updated = await tx.subscriptionPlan.update({ where: { id }, data: { name: values.name, slug: values.slug, description: values.description, price: values.price, interval: values.interval, monthlyPrice: values.price, annualPrice: values.price, currency: values.currency, trialDays: values.trialDays, isActive: values.isActive, sortOrder: values.sortOrder, stripeEnabled: values.stripeEnabled, paypalEnabled: values.paypalEnabled }, select: { id: true, name: true, slug: true } }); await tx.subscriptionPlanEntitlement.deleteMany({ where: { planId: id } }); if (values.entitlements.length) await tx.subscriptionPlanEntitlement.createMany({ data: values.entitlements.map((entry) => ({ ...entry, planId: id })) }); return updated; });
  await auditPlan(context.user.id, id, "update", plan.name); return plan;
}
export async function setGlobalPlanActive(id: string, isActive: boolean) { const context = await requireGlobalAdmin({ sensitive: true }); const plan = await db.subscriptionPlan.update({ where: { id }, data: { isActive }, select: { id: true, name: true, isActive: true } }); await auditPlan(context.user.id, id, isActive ? "activate" : "deactivate", plan.name); return plan; }
export async function reorderGlobalPlans(ids: string[]) { const context = await requireGlobalAdmin({ sensitive: true }); const existing = await db.subscriptionPlan.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }); if (existing.length !== ids.length || new Set(ids).size !== ids.length) throw new Error("Order must contain every plan exactly once."); await db.$transaction(ids.map((id, index) => db.subscriptionPlan.update({ where: { id }, data: { sortOrder: index } }))); await auditPlan(context.user.id, "all", "reorder", "subscription plans"); return { ok: true }; }
async function auditPlan(actorId: string, targetId: string, operation: string, name: string) { await logAudit({ activityType: "billing-subscription-plan-changed", summary: `${operation} subscription plan ${name}.`, actorId, details: buildGlobalAuditDetails({ churchId: "platform", targetType: "subscription-plan", targetId, metadata: { operation } }) }); }
