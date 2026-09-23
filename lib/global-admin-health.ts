import { db } from "@/lib/db";
import { SITE_REVISION } from "@/lib/site";

export async function getGlobalHealth() {
  const checkedAt = new Date().toISOString();
  try {
    const [database, lifecycle, onboarding] = await Promise.all([
      db.$queryRaw`SELECT 1`,
      db.church.groupBy({ by: ["lifecycleStatus"], _count: { _all: true } }),
      db.church.groupBy({ by: ["onboardingStatus"], _count: { _all: true } })
    ]);
    return { status: "ready", checkedAt, revision: SITE_REVISION, environment: process.env.NODE_ENV, database: "ready", sites: { lifecycle: Object.fromEntries(lifecycle.map((row) => [row.lifecycleStatus, row._count._all])), onboarding: Object.fromEntries(onboarding.map((row) => [row.onboardingStatus, row._count._all])) } };
  } catch {
    return { status: "degraded", checkedAt, revision: SITE_REVISION, environment: process.env.NODE_ENV, database: "unavailable", sites: null };
  }
}
