import { requireCurrentChurch } from "@/lib/tenant";
import CheckoutReview from "./review";

export default async function BillingCheckoutPage({ searchParams }: { searchParams: { planId?: string; provider?: string; interval?: string; couponCode?: string; customDomain?: string } }) {
  await requireCurrentChurch({ allowUnsubscribed: true });
  return <CheckoutReview initial={searchParams} />;
}
