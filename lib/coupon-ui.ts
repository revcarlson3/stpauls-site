export function couponDiscountLabel(discountType: unknown, currency: string) {
  return discountType === "FIXED_AMOUNT" ? `Amount off (${currency || "currency"})` : "Percentage off";
}
