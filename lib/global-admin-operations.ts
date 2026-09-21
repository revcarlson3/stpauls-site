import { db } from "@/lib/db";

const OPEN_SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_TENANT"] as const;
type CountGroup = { _count: { _all: number } };
type LifecycleGroup = CountGroup & { lifecycleStatus: string };
type OnboardingGroup = CountGroup & { onboardingStatus: string };
type DomainStatusGroup = CountGroup & { status: string };
type TlsStatusGroup = CountGroup & { tlsStatus: string | null };
type AuditEntry = { id: string; activityType: string; summary: string; createdAt: Date; actor: { name: string; email: string } | null };

export async function getGlobalAdminOperations(now = new Date()) {
  const [lifecycleGroups, onboardingGroups, totalUsers, openSupportTickets, activeAnnouncements, domains, verifiedDomains, domainStatusGroups, tlsStatusGroups, recentAuditActivity] = await Promise.all([
    db.church.groupBy({ by: ["lifecycleStatus"], _count: { _all: true } }),
    db.church.groupBy({ by: ["onboardingStatus"], _count: { _all: true } }),
    db.user.count(),
    db.supportTicket.count({ where: { status: { in: [...OPEN_SUPPORT_STATUSES] } } }),
    db.globalAnnouncement.count({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    }),
    db.siteDomain.count(),
    db.siteDomain.count({ where: { verifiedAt: { not: null } } }),
    db.siteDomain.groupBy({ by: ["status"], _count: { _all: true } }),
    db.siteDomain.groupBy({ by: ["tlsStatus"], _count: { _all: true } }),
    db.auditLog.findMany({
      where: { activityType: { startsWith: "global-admin-" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, activityType: true, summary: true, createdAt: true, actor: { select: { name: true, email: true } } }
    })
  ]);

  return {
    sites: {
      total: (lifecycleGroups as LifecycleGroup[]).reduce((total: number, group: LifecycleGroup) => total + group._count._all, 0),
      byLifecycle: Object.fromEntries((lifecycleGroups as LifecycleGroup[]).map((group: LifecycleGroup) => [group.lifecycleStatus, group._count._all]))
    },
    onboarding: {
      total: (onboardingGroups as OnboardingGroup[]).reduce((total: number, group: OnboardingGroup) => total + group._count._all, 0),
      byStatus: Object.fromEntries((onboardingGroups as OnboardingGroup[]).map((group: OnboardingGroup) => [group.onboardingStatus, group._count._all]))
    },
    users: { total: totalUsers },
    support: { open: openSupportTickets },
    announcements: { active: activeAnnouncements },
    domains: {
      total: domains,
      verified: verifiedDomains,
      unverified: domains - verifiedDomains,
      byStatus: Object.fromEntries((domainStatusGroups as DomainStatusGroup[]).map((group: DomainStatusGroup) => [group.status, group._count._all])),
      byTlsStatus: Object.fromEntries((tlsStatusGroups as TlsStatusGroup[]).map((group: TlsStatusGroup) => [group.tlsStatus ?? "NOT_REPORTED", group._count._all]))
    },
    recentAuditActivity: (recentAuditActivity as AuditEntry[]).map((entry: AuditEntry) => ({
      id: entry.id,
      activityType: entry.activityType,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
      actor: entry.actor?.name ?? entry.actor?.email ?? "System"
    }))
  };
}
