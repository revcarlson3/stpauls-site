type DateLike = Date | string;

export type GlobalAdminOverviewRecord = {
  onboarding: {
    status: string;
    currentStep: string;
    siteIdentityDone: boolean;
    modulesDone: boolean;
    securityDone: boolean;
    completedAt: DateLike | null;
  } | null;
  domains: Array<{
    hostname: string;
    kind: string;
    status: string;
    tlsStatus: string | null;
    verifiedAt: DateLike | null;
    lastCheckedAt: DateLike | null;
  }>;
  subscription: {
    status: string;
    provider: string;
    interval: string;
    currentPeriodEnd: DateLike | null;
    cancelAtPeriodEnd: boolean;
    plan: { name: string; slug: string; currency: string } | null;
  } | null;
  support: {
    openCount: number;
    recentCount: number;
    recentTickets: Array<{
      id: string;
      subject: string;
      status: string;
      priority: string;
      updatedAt: DateLike;
    }>;
  };
  announcements: {
    activeCount: number;
    recentCount: number;
    recent: Array<{
      id: string;
      title: string;
      severity: string;
      publishedAt: DateLike;
      acknowledgedAt: DateLike | null;
    }>;
  };
};

function serializeDate(value: DateLike | null) {
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeGlobalAdminOverview(record: GlobalAdminOverviewRecord) {
  return {
    onboarding: record.onboarding && {
      status: record.onboarding.status,
      currentStep: record.onboarding.currentStep,
      completion: {
        siteIdentity: record.onboarding.siteIdentityDone,
        modules: record.onboarding.modulesDone,
        security: record.onboarding.securityDone,
        completedAt: serializeDate(record.onboarding.completedAt)
      }
    },
    domains: record.domains.map((domain) => ({
      hostname: domain.hostname,
      kind: domain.kind,
      status: domain.status,
      tlsStatus: domain.tlsStatus,
      verification: {
        verified: domain.verifiedAt !== null,
        verifiedAt: serializeDate(domain.verifiedAt),
        lastCheckedAt: serializeDate(domain.lastCheckedAt)
      }
    })),
    subscription: record.subscription && {
      status: record.subscription.status,
      provider: record.subscription.provider,
      interval: record.subscription.interval,
      currentPeriodEnd: serializeDate(record.subscription.currentPeriodEnd),
      cancelAtPeriodEnd: record.subscription.cancelAtPeriodEnd,
      plan: record.subscription.plan
    },
    support: {
      openCount: record.support.openCount,
      recentCount: record.support.recentCount,
      recentTickets: record.support.recentTickets.map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        updatedAt: serializeDate(ticket.updatedAt)
      }))
    },
    announcements: {
      activeCount: record.announcements.activeCount,
      recentCount: record.announcements.recentCount,
      recent: record.announcements.recent.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        severity: announcement.severity,
        publishedAt: serializeDate(announcement.publishedAt),
        acknowledgedAt: serializeDate(announcement.acknowledgedAt)
      }))
    }
  };
}
