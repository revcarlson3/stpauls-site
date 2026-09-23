import { db } from "@/lib/db";
import { BillingProvider, SubscriptionStatus } from "@prisma/client";

const PAGE_SIZE = 25;

export type BillingQuery = {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
  page?: number;
};

export async function getGlobalBillingOverview(query: BillingQuery = {}) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const search = query.search?.trim();
  const subscriptionWhere = {
    ...(query.status ? { status: query.status as SubscriptionStatus } : {}),
    ...(query.provider ? { provider: query.provider as BillingProvider } : {}),
    ...(query.plan ? { plan: { slug: query.plan } } : {}),
    ...(search ? { church: { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] } } : {})
  };
  const [subscriptions, sitesWithoutSubscriptions, statusCounts, planCounts, providerCounts, cancellationCounts, totalSites] = await Promise.all([
    db.subscription.findMany({
      where: subscriptionWhere,
      orderBy: { updatedAt: "desc" },
      select: { id: true, provider: true, interval: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, canceledAt: true, gracePeriodEndsAt: true, updatedAt: true, church: { select: { id: true, name: true, slug: true, lifecycleStatus: true } }, plan: { select: { name: true, slug: true, currency: true } } }
    }),
    query.status || query.plan || query.provider ? Promise.resolve([]) : db.church.findMany({
      where: { subscriptions: { none: {} }, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, lifecycleStatus: true }
    }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    db.subscription.groupBy({ by: ["planId"], _count: { _all: true } }),
    db.subscription.groupBy({ by: ["provider"], _count: { _all: true } }),
    db.subscription.groupBy({ by: ["cancelAtPeriodEnd"], _count: { _all: true } }),
    db.church.count()
  ]);
  const rows = [
    ...subscriptions.map(({ id, provider, interval, status, currentPeriodEnd, cancelAtPeriodEnd, canceledAt, gracePeriodEndsAt, updatedAt, church, plan }) => ({ id, site: church, plan, provider, interval, status, currentPeriodEnd, cancelAtPeriodEnd, canceledAt, gracePeriodEndsAt, updatedAt })),
    ...sitesWithoutSubscriptions.map((site) => ({ id: `site:${site.id}`, site, plan: null, provider: null, interval: null, status: "NO_SUBSCRIPTION", currentPeriodEnd: null, cancelAtPeriodEnd: false, canceledAt: null, gracePeriodEndsAt: null, updatedAt: null }))
  ];
  const total = rows.length;
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    totalSites,
    totalSubscriptions: subscriptions.length,
    totalSitesWithoutSubscriptions: sitesWithoutSubscriptions.length,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    subscriptions: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    counts: Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count._all])),
    aggregates: {
      status: Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count._all])),
      plan: Object.fromEntries(planCounts.map((entry) => [entry.planId, entry._count._all])),
      provider: Object.fromEntries(providerCounts.map((entry) => [entry.provider, entry._count._all])),
      cancellation: Object.fromEntries(cancellationCounts.map((entry) => [entry.cancelAtPeriodEnd ? "AT_PERIOD_END" : "NOT_SCHEDULED", entry._count._all]))
    }
  };
}
