import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireCurrentChurch } from "@/lib/tenant";

export async function validateTenantCoupon(input: { code: unknown; planId: unknown; interval: unknown }) {
  await requirePermission("MANAGE_SETTINGS");
  const { church } = await requireCurrentChurch();
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!code) throw new Error("Enter a coupon code.");
  if (typeof input.planId !== "string" || !input.planId) throw new Error("A billing plan is required.");
  const plan = await db.subscriptionPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true, currency: true, price: true, interval: true, monthlyPrice: true, annualPrice: true } });
  if (!plan) throw new Error("Billing plan is unavailable.");
  const interval = plan.interval ?? "MONTHLY";
  if (input.interval && input.interval !== interval) throw new Error("The selected plan has a fixed billing interval.");
  const coupon = await db.promotion.findUnique({ where: { code }, select: { id: true, code: true, isActive: true, discountType: true, percentageOff: true, amountOff: true, currency: true, startsAt: true, endsAt: true, appliesMonthly: true, appliesQuarterly: true, appliesSemiAnnual: true, appliesAnnual: true, maxRedemptions: true, redemptionCount: true, maxPerAccount: true, redemptions: { where: { churchId: church.id }, select: { id: true } } } });
  const now = new Date();
  if (!coupon || !coupon.isActive || coupon.startsAt > now || (coupon.endsAt && coupon.endsAt <= now)) throw new Error("This coupon is invalid or expired.");
  const applicable = interval === "MONTHLY" ? coupon.appliesMonthly : interval === "QUARTERLY" ? coupon.appliesQuarterly : interval === "SEMI_ANNUAL" ? coupon.appliesSemiAnnual : coupon.appliesAnnual;
  if (!applicable) throw new Error("This coupon is not valid for the selected billing interval.");
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) throw new Error("This coupon has reached its usage limit.");
  if (coupon.maxPerAccount !== null && coupon.redemptions.length >= coupon.maxPerAccount) throw new Error("This coupon has already reached its limit for this account.");
  if (coupon.currency !== plan.currency) throw new Error("This coupon is not valid for the selected plan currency.");
  const subtotal = Number((plan.price ?? (interval === "MONTHLY" ? plan.monthlyPrice : plan.annualPrice)).toString());
  const discount = coupon.discountType === "PERCENTAGE" ? subtotal * ((coupon.percentageOff ?? 0) / 100) : Number((coupon.amountOff ?? 0).toString());
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  return { couponId: coupon.id, code: coupon.code, discountType: coupon.discountType, subtotal: subtotal.toFixed(2), discount: Math.min(subtotal, discount).toFixed(2), total: total.toFixed(2), currency: plan.currency };
}
