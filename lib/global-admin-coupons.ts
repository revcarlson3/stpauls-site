import { PromotionDiscountType } from "@prisma/client";
import { db } from "@/lib/db";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";
import { logAudit } from "@/lib/audit";

function parseDate(value: unknown, name: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be a valid date.`);
  return new Date(value);
}

export function validateCouponInput(input: Record<string, unknown>) {
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(code)) throw new Error("Coupon code must be 3-64 letters, numbers, underscores, or hyphens.");
  if (input.discountType !== "PERCENTAGE" && input.discountType !== "FIXED_AMOUNT") throw new Error("Choose a percentage or fixed-dollar discount.");
  const percentage = input.percentageOff === null || input.percentageOff === undefined || input.percentageOff === "" ? null : Number(input.percentageOff);
  const amount = input.amountOff === null || input.amountOff === undefined || input.amountOff === "" ? null : Number(input.amountOff);
  if (input.discountType === "PERCENTAGE" && (percentage === null || !Number.isInteger(percentage) || percentage < 0 || percentage > 100 || amount !== null)) throw new Error("Percentage discounts require a whole-number percentage from 0 to 100 and no fixed amount.");
  if (input.discountType === "FIXED_AMOUNT" && (amount === null || !Number.isFinite(amount) || amount < 0 || percentage !== null)) throw new Error("Fixed discounts require a nonnegative amount and no percentage.");
  const startsAt = input.startsAt ? parseDate(input.startsAt, "Start date") : new Date();
  const endsAt = input.endsAt ? parseDate(input.endsAt, "Expiration date") : null;
  if (endsAt && endsAt <= startsAt) throw new Error("Expiration date must be after the start date.");
  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "USD";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code.");
  return { code, name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : code, discountType: input.discountType as PromotionDiscountType, percentageOff: percentage, amountOff: amount, currency, startsAt, endsAt, appliesMonthly: input.appliesMonthly !== false, appliesAnnual: input.appliesAnnual !== false, isActive: input.isActive !== false };
}

export async function listGlobalCoupons(search = "") {
  await requireGlobalAdmin();
  return db.promotion.findMany({ where: search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : undefined, orderBy: { createdAt: "desc" }, select: { id: true, code: true, name: true, discountType: true, percentageOff: true, amountOff: true, currency: true, startsAt: true, endsAt: true, appliesMonthly: true, appliesAnnual: true, isActive: true, redemptionCount: true, updatedAt: true } });
}

export async function createGlobalCoupon(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true }); const values = validateCouponInput(input);
  const coupon = await db.promotion.create({ data: values, select: { id: true, code: true, name: true, discountType: true, percentageOff: true, amountOff: true, currency: true, startsAt: true, endsAt: true, appliesMonthly: true, appliesAnnual: true, isActive: true } });
  await logAudit({ activityType: "billing-coupon-changed", summary: `Created platform coupon ${coupon.code}.`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: "platform", targetType: "billing-coupon", targetId: coupon.id, metadata: { operation: "create", discountType: coupon.discountType } }) });
  return coupon;
}

export async function updateGlobalCoupon(id: string, input: Record<string, unknown>, operation: "update" | "disable" | "delete") {
  const context = await requireGlobalAdmin({ sensitive: true });
  if (operation === "delete") { const deleted = await db.promotion.delete({ where: { id } }); await logAudit({ activityType: "billing-coupon-changed", summary: `Deleted platform coupon ${deleted.code}.`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: "platform", targetType: "billing-coupon", targetId: id, metadata: { operation } }) }); return { id, deleted: true }; }
  const values = operation === "disable" ? { isActive: false } : validateCouponInput(input);
  const coupon = await db.promotion.update({ where: { id }, data: values, select: { id: true, code: true, isActive: true, discountType: true } });
  await logAudit({ activityType: "billing-coupon-changed", summary: `${operation === "disable" ? "Disabled" : "Updated"} platform coupon ${coupon.code}.`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: "platform", targetType: "billing-coupon", targetId: id, metadata: { operation } }) });
  return coupon;
}

export async function findApplicablePromotion(code: string, interval: "MONTHLY" | "ANNUAL", currency: string, at = new Date()) {
  const coupon = await db.promotion.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.isActive || coupon.currency !== currency || coupon.startsAt > at || (coupon.endsAt && coupon.endsAt <= at) || (interval === "MONTHLY" ? !coupon.appliesMonthly : !coupon.appliesAnnual)) return null;
  return coupon;
}
