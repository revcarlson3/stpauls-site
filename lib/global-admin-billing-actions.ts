import { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireGlobalAdmin } from "@/lib/global-admin";

export const billingActions = ["CANCEL_AT_PERIOD_END", "RESUME_CANCELLATION", "REFRESH"] as const;
type BillingAction = (typeof billingActions)[number];

export async function previewGlobalBillingAction(subscriptionId: string, action: string) {
  await requireGlobalAdmin();
  if (!billingActions.includes(action as BillingAction)) throw new Error("Unsupported billing action.");
  const subscription = await db.subscription.findUnique({ where: { id: subscriptionId }, select: { id: true, provider: true, status: true, cancelAtPeriodEnd: true, church: { select: { id: true, name: true, slug: true } }, plan: { select: { name: true } } } });
  if (!subscription) return null;
  return { subscriptionId: subscription.id, action, provider: subscription.provider, currentStatus: subscription.status, currentCancelAtPeriodEnd: subscription.cancelAtPeriodEnd, site: subscription.church, plan: subscription.plan };
}

export async function executeGlobalBillingAction(subscriptionId: string, action: string, confirm: boolean) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const preview = await previewGlobalBillingAction(subscriptionId, action);
  if (!preview) return null;
  if (!confirm) return { ...preview, confirmationRequired: true };
  const subscription = await db.subscription.findUnique({ where: { id: subscriptionId }, select: { id: true, provider: true, externalSubscriptionId: true, status: true, cancelAtPeriodEnd: true, churchId: true } });
  if (!subscription?.externalSubscriptionId) throw new Error("The provider subscription is not available for this action.");
  if (subscription.provider === "PAYPAL" && action !== "REFRESH") throw new Error("PayPal scheduled cancellation is not available through the configured provider API.");
  const { performProviderBillingAction } = await import("@/lib/billing-providers");
  const providerState = await performProviderBillingAction(subscription.provider, subscription.externalSubscriptionId, action);
  const data = action === "CANCEL_AT_PERIOD_END" ? { cancelAtPeriodEnd: true } : action === "RESUME_CANCELLATION" ? { cancelAtPeriodEnd: false } : { status: providerState.status as SubscriptionStatus, cancelAtPeriodEnd: providerState.cancelAtPeriodEnd };
  const updated = await db.subscription.update({ where: { id: subscription.id }, data, select: { id: true, status: true, cancelAtPeriodEnd: true, provider: true } });
  await logAudit({ activityType: "billing-subscription-action", summary: `Applied ${action} to a ${subscription.provider} subscription.`, actorId: context.user.id, details: JSON.stringify({ boundary: "global-admin-billing", churchId: subscription.churchId, targetType: "subscription", targetId: subscription.id, metadata: { action, provider: subscription.provider } }) });
  return { ...updated, site: preview.site, action, confirmed: true };
}
