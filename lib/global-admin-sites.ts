import { db } from "@/lib/db";
import { buildGlobalAuditDetails, lifecycleAuditMetadata, nextLifecycleState, requireGlobalAdmin, type LifecycleAction } from "@/lib/global-admin";
import { lifecycleActions } from "@/lib/global-admin";

export async function listGlobalSites(input: { search?: string; lifecycle?: string; onboarding?: string; page?: number; pageSize?: number }) {
  await requireGlobalAdmin();
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 25));
  const page = Math.max(1, input.page ?? 1);
  const search = input.search?.trim();
  const where = { ...(input.lifecycle ? { lifecycleStatus: input.lifecycle as never } : {}), ...(input.onboarding ? { onboardingStatus: input.onboarding as never } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] } : {}) };
  const [total, sites] = await Promise.all([
    db.church.count({ where }),
    db.church.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, name: true, slug: true, status: true, lifecycleStatus: true, onboardingStatus: true, onboardingStep: true, createdAt: true, updatedAt: true } })
  ]);
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize), sites };
}

export function previewBulkLifecycle(sites: Array<{ id: string; name: string; lifecycleStatus: string; onboardingStatus: string }>, action: string) {
  const validAction = lifecycleActions.includes(action as LifecycleAction);
  return {
    action,
    validAction,
    sites: sites.map((site) => {
      const next = validAction ? nextLifecycleState({ lifecycleStatus: site.lifecycleStatus as never, onboardingStatus: site.onboardingStatus as never }, action as LifecycleAction) : null;
      return { id: site.id, name: site.name, currentLifecycle: site.lifecycleStatus, proposedLifecycle: next?.lifecycleStatus ?? null, valid: Boolean(next), reason: next ? null : validAction ? `Cannot ${action} from ${site.lifecycleStatus}.` : "Unsupported lifecycle action." };
    })
  };
}

export async function bulkLifecycleTransition(input: { siteIds: string[]; action: string; confirm: boolean }) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const siteIds = Array.from(new Set(input.siteIds)).filter((id) => typeof id === "string" && id.length > 0);
  if (!siteIds.length || siteIds.length > 100) throw new Error("Select between 1 and 100 sites.");
  if (!lifecycleActions.includes(input.action as LifecycleAction)) throw new Error("Unsupported lifecycle action.");
  const sites = await db.church.findMany({ where: { id: { in: siteIds } }, select: { id: true, name: true, lifecycleStatus: true, onboardingStatus: true } });
  const preview = previewBulkLifecycle(sites, input.action);
  const missing = siteIds.filter((id) => !sites.some((site) => site.id === id));
  const invalid = [...preview.sites.filter((site) => !site.valid).map((site) => ({ id: site.id, name: site.name, error: site.reason })), ...missing.map((id) => ({ id, name: id, error: "Site was not found." }))];
  if (invalid.length) return { action: input.action, committed: false, blocked: invalid, results: [] };
  if (!input.confirm) return { action: input.action, committed: false, blocked: [], results: [], preview: preview.sites };
  const results = [];
  for (const site of sites) {
    const next = nextLifecycleState({ lifecycleStatus: site.lifecycleStatus as never, onboardingStatus: site.onboardingStatus as never }, input.action as LifecycleAction)!;
    try {
      const updated = await db.$transaction(async (transaction) => {
        const result = await transaction.church.update({ where: { id: site.id }, data: { lifecycleStatus: next.lifecycleStatus, onboardingStatus: next.onboardingStatus, status: next.lifecycleStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" }, select: { id: true, name: true, lifecycleStatus: true, onboardingStatus: true } });
        await transaction.auditLog.create({ data: { activityType: "global-admin-lifecycle-changed", summary: `Changed ${site.name} lifecycle to ${result.lifecycleStatus.toLowerCase()}.`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: site.id, targetType: "church-lifecycle-bulk", targetId: site.id, metadata: { ...lifecycleAuditMetadata(input.action as LifecycleAction, site, next), bulk: true } }) } });
        return result;
      });
      results.push({ id: site.id, name: site.name, success: true, lifecycleStatus: updated.lifecycleStatus });
    } catch (error) {
      results.push({ id: site.id, name: site.name, success: false, error: error instanceof Error ? error.message : "Transition failed." });
    }
  }
  return { action: input.action, committed: results.every((result) => result.success), blocked: [], results };
}
