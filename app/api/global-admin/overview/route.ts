import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { serializeGlobalAdminOverview } from "@/lib/global-admin-overview";

export async function GET() {
  let context;
  try {
    context = await requireGlobalAdmin({ selectedChurch: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: "Bridge access and a selected site are required." }, { status: 403 });
    }
    return NextResponse.json({ error: "A selected site is required." }, { status: 409 });
  }

  const churchId = context.church!.id;
  const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const [church, activeUsers, onboarding, domains, subscription, openSupportTickets, recentSupportTickets, recentTickets, activeAnnouncements, recentAnnouncements, recentAnnouncementDeliveries] = await Promise.all([
    db.church.findUnique({
      where: { id: churchId },
      select: {
        name: true,
        slug: true,
        city: true,
        state: true,
        status: true,
        lifecycleStatus: true,
        onboardingStatus: true,
        onboardingStep: true,
        createdAt: true
      }
    }),
    db.churchUser.count({ where: { churchId, user: { isActive: true } } }),
    db.tenantOnboarding.findUnique({ where: { churchId }, select: { status: true, currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true, completedAt: true } }),
    db.siteDomain.findMany({ where: { churchId }, orderBy: { updatedAt: "desc" }, select: { hostname: true, kind: true, status: true, tlsStatus: true, verifiedAt: true, lastCheckedAt: true } }),
    db.subscription.findFirst({ where: { churchId }, orderBy: { updatedAt: "desc" }, select: { status: true, provider: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, plan: { select: { name: true, slug: true, currency: true } } } }),
    db.supportTicket.count({ where: { churchId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_TENANT"] } } }),
    db.supportTicket.count({ where: { churchId, updatedAt: { gte: recentSince } } }),
    db.supportTicket.findMany({ where: { churchId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, subject: true, status: true, priority: true, updatedAt: true } }),
    db.globalAnnouncementDelivery.count({ where: { churchId, announcement: { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } } }),
    db.globalAnnouncementDelivery.count({ where: { churchId, publishedAt: { gte: recentSince } } }),
    db.globalAnnouncementDelivery.findMany({ where: { churchId }, orderBy: { publishedAt: "desc" }, take: 5, select: { id: true, publishedAt: true, acknowledgedAt: true, announcement: { select: { title: true, severity: true } } } })
  ]);

  if (!church) return NextResponse.json({ error: "The selected site is unavailable." }, { status: 404 });

  return NextResponse.json({
    site: {
      name: church.name,
      slug: church.slug,
      location: [church.city, church.state].filter(Boolean).join(", ") || null,
      status: church.status,
      createdAt: church.createdAt.toISOString()
    },
    lifecycle: {
      status: church.lifecycleStatus,
      onboardingStatus: church.onboardingStatus,
      currentStep: church.onboardingStep ?? null
    },
    operational: serializeGlobalAdminOverview({
      onboarding,
      domains,
      subscription,
      support: { openCount: openSupportTickets, recentCount: recentSupportTickets, recentTickets },
      announcements: {
        activeCount: activeAnnouncements,
        recentCount: recentAnnouncements,
        recent: recentAnnouncementDeliveries.map((delivery) => ({ id: delivery.id, title: delivery.announcement.title, severity: delivery.announcement.severity, publishedAt: delivery.publishedAt, acknowledgedAt: delivery.acknowledgedAt }))
      }
    }),
    health: {
      users: activeUsers,
      activeUsers
    },
    setup: {
      siteIdentity: false,
      modules: false,
      security: false
    },
    recentActions: []
  });
}
