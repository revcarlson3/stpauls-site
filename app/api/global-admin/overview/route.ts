import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGlobalAdmin } from "@/lib/global-admin";

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
  const [church, activeUsers, domains, openSupportTickets, subscription, announcements] = await Promise.all([
    db.church.findUnique({
      where: { id: churchId },
      select: {
        name: true,
        slug: true,
        city: true,
        state: true,
        status: true,
        createdAt: true,
        tenantAccount: { select: { lifecycleStatus: true, onboardingStatus: true } },
        onboarding: { select: { currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true, completedAt: true } }
      }
    }),
    db.churchUser.count({ where: { churchId, user: { isActive: true } } }),
    db.siteDomain.findMany({ where: { churchId }, select: { status: true } }),
    db.supportTicket.count({ where: { churchId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_TENANT"] } } }),
    db.subscription.findFirst({ where: { churchId, status: "ACTIVE" }, select: { interval: true, currentPeriodEnd: true } }),
    db.globalAnnouncementDelivery.count({ where: { churchId, announcement: { isActive: true } } })
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
      status: church.tenantAccount?.lifecycleStatus ?? "PROVISIONING",
      onboardingStatus: church.tenantAccount?.onboardingStatus ?? (church.onboarding?.completedAt ? "COMPLETE" : "SITE_SETUP"),
      currentStep: church.onboarding?.currentStep ?? null
    },
    health: {
      activeUsers,
      domains: {
        total: domains.length,
        active: domains.filter((domain) => domain.status === "ACTIVE").length,
        pending: domains.filter((domain) => ["PENDING", "VERIFYING"].includes(domain.status)).length,
        failed: domains.filter((domain) => domain.status === "FAILED").length
      },
      openSupportTickets,
      subscription: subscription ? { status: "ACTIVE", interval: subscription.interval, currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null } : null,
      activeAnnouncements: announcements
    },
    setup: {
      siteIdentity: church.onboarding?.siteIdentityDone ?? false,
      modules: church.onboarding?.modulesDone ?? false,
      security: church.onboarding?.securityDone ?? false
    }
  });
}
