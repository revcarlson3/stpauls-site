import { db } from "@/lib/db";
import { auditActivityTypes } from "@/lib/audit";

const MAX_PAGE_SIZE = 50;
const DETAIL_LIMIT = 2000;

export type GlobalAuditFilters = {
  page?: number;
  pageSize?: number;
  activityType?: string;
  churchId?: string;
  actor?: string;
  search?: string;
  from?: string;
  to?: string;
};

function dateFilter(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizeGlobalAuditFilters(input: GlobalAuditFilters) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const pageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, MAX_PAGE_SIZE) : 25;
  const activityType = input.activityType && auditActivityTypes.includes(input.activityType as typeof auditActivityTypes[number]) ? input.activityType : undefined;
  return {
    page,
    pageSize,
    activityType,
    churchId: input.churchId?.trim() || undefined,
    actor: input.actor?.trim() || undefined,
    search: input.search?.trim() || undefined,
    from: dateFilter(input.from),
    to: dateFilter(input.to, true)
  };
}

export async function getGlobalAdminAudit(filters: GlobalAuditFilters = {}) {
  const normalized = normalizeGlobalAuditFilters(filters);
  const where = {
    ...(normalized.activityType ? { activityType: normalized.activityType } : {}),
    ...(normalized.churchId ? { churchId: normalized.churchId } : {}),
    ...(normalized.from || normalized.to ? { createdAt: { ...(normalized.from ? { gte: normalized.from } : {}), ...(normalized.to ? { lte: normalized.to } : {}) } } : {}),
    ...(normalized.actor ? { actor: { is: { OR: [{ name: { contains: normalized.actor, mode: "insensitive" as const } }, { email: { contains: normalized.actor, mode: "insensitive" as const } }] } } } : {}),
    ...(normalized.search ? {
      OR: [
        { summary: { contains: normalized.search, mode: "insensitive" as const } },
        { details: { contains: normalized.search, mode: "insensitive" as const } },
        { targetType: { contains: normalized.search, mode: "insensitive" as const } },
        { targetId: { contains: normalized.search, mode: "insensitive" as const } }
      ]
    } : {})
  };
  const [total, rows, sites] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (normalized.page - 1) * normalized.pageSize,
      take: normalized.pageSize,
      select: {
        id: true, activityType: true, summary: true, details: true, targetType: true, targetId: true, createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
        church: { select: { id: true, name: true, slug: true } }
      }
    }),
    db.church.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } })
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      activityType: row.activityType,
      summary: row.summary,
      details: row.details?.slice(0, DETAIL_LIMIT) ?? null,
      target: row.targetType || row.targetId ? { type: row.targetType, id: row.targetId } : null,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor ? { id: row.actor.id, name: row.actor.name, email: row.actor.email } : null,
      site: row.church ? { id: row.church.id, name: row.church.name, slug: row.church.slug } : null
    })),
    sites,
    pagination: {
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / normalized.pageSize))
    }
  };
}
