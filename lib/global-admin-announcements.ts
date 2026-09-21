import { db } from "@/lib/db";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";

const severities = ["INFO", "SUCCESS", "WARNING", "CRITICAL"] as const;
export type AnnouncementSeverity = (typeof severities)[number];
export const announcementAudiences = ["GLOBAL", "TENANT"] as const;
export const announcementPlacements = ["AUTHENTICATED", "PUBLIC_TICKER", "BOTH", "ADMIN_DASHBOARD"] as const;

export function isAnnouncementSeverity(value: string): value is AnnouncementSeverity {
  return severities.includes(value as AnnouncementSeverity);
}

function serializeAnnouncement(announcement: {
  id: string;
  title: string;
  body: string;
  severity: string;
  audience: string;
  placement: string;
  church: { id: string; name: string; slug: string } | null;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deliveries: Array<{ acknowledgedAt: Date | null }>;
}) {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    severity: announcement.severity,
    audience: announcement.audience,
    placement: announcement.placement,
    tenant: announcement.church,
    startsAt: announcement.startsAt.toISOString(),
    endsAt: announcement.endsAt?.toISOString() ?? null,
    isActive: announcement.isActive,
    createdAt: announcement.createdAt.toISOString(),
    updatedAt: announcement.updatedAt.toISOString(),
    deliveryCount: announcement.deliveries.length,
    acknowledgedCount: announcement.deliveries.filter((delivery) => delivery.acknowledgedAt).length
  };
}

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  severity: true,
  audience: true,
  placement: true,
  church: { select: { id: true, name: true, slug: true } },
  startsAt: true,
  endsAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deliveries: { select: { acknowledgedAt: true } }
} as const;

export async function listGlobalAnnouncements() {
  await requireGlobalAdmin();
  const announcements = await db.globalAnnouncement.findMany({ orderBy: [{ isActive: "desc" }, { startsAt: "desc" }], select: announcementSelect });
  return announcements.map(serializeAnnouncement);
}

export function parseAnnouncementInput(input: Record<string, unknown>, options: { allowTenant?: boolean } = {}) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const severity = typeof input.severity === "string" ? input.severity.trim().toUpperCase() : "INFO";
  const audience = typeof input.audience === "string" ? input.audience.trim().toUpperCase() : "GLOBAL";
  const placement = typeof input.placement === "string" ? input.placement.trim().toUpperCase() : "AUTHENTICATED";
  const churchId = typeof input.churchId === "string" && input.churchId.trim() ? input.churchId.trim() : null;
  const startsAt = typeof input.startsAt === "string" && input.startsAt.trim() ? new Date(input.startsAt) : new Date();
  const endsAt = typeof input.endsAt === "string" && input.endsAt.trim() ? new Date(input.endsAt) : null;
  const isActive = input.isActive === undefined ? true : input.isActive === true;
  if (!title || title.length > 200) throw new Error("Title is required and must be 200 characters or fewer.");
  if (!body || body.length > 20000) throw new Error("Message is required and must be 20,000 characters or fewer.");
  if (!isAnnouncementSeverity(severity)) throw new Error("Invalid announcement severity.");
  if (!announcementAudiences.includes(audience as (typeof announcementAudiences)[number])) throw new Error("Invalid announcement audience.");
  if (!announcementPlacements.includes(placement as (typeof announcementPlacements)[number])) throw new Error("Invalid announcement placement.");
  if (audience === "TENANT" && !churchId) throw new Error("A tenant must be selected for tenant announcements.");
  if (audience === "GLOBAL" && churchId) throw new Error("Global announcements cannot target a tenant.");
  if (audience === "TENANT" && !options.allowTenant) throw new Error("Tenant announcements are not allowed here.");
  if (placement === "ADMIN_DASHBOARD" && audience !== "GLOBAL") throw new Error("Admin Dashboard announcements must be global.");
  if (placement !== "AUTHENTICATED" && audience === "TENANT") throw new Error("Tenant announcements can only target authenticated users.");
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new Error("Announcement dates are invalid.");
  if (endsAt && endsAt <= startsAt) throw new Error("The end date must be after the start date.");
  return { title, body, severity, audience, placement, churchId, startsAt, endsAt, isActive };
}

export async function createGlobalAnnouncement(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const data = parseAnnouncementInput(input);
  if (data.audience === "TENANT" && !(await db.church.findFirst({ where: { id: data.churchId!, status: "ACTIVE" }, select: { id: true } }))) throw new Error("The selected tenant is not active.");
  const announcement = await db.$transaction(async (transaction) => {
    const created = await transaction.globalAnnouncement.create({ data, select: { id: true } });
    const churches = await transaction.church.findMany({ where: data.audience === "TENANT" ? { id: data.churchId!, status: "ACTIVE" } : { status: "ACTIVE" }, select: { id: true } });
    if (churches.length) {
      await transaction.globalAnnouncementDelivery.createMany({
        data: churches.map((church) => ({ announcementId: created.id, churchId: church.id })),
        skipDuplicates: true
      });
    }
    await transaction.auditLog.create({
      data: {
        activityType: "global-admin-announcement-created",
        summary: `Created global announcement "${data.title}".`,
        actorId: context.user.id,
        details: buildGlobalAuditDetails({ churchId: churches[0]?.id ?? "platform", targetType: "global-announcement", targetId: created.id, metadata: { audience: data.audience, placement: data.placement, severity: data.severity, deliveryCount: churches.length } })
      }
    });
    return transaction.globalAnnouncement.findUniqueOrThrow({ where: { id: created.id }, select: announcementSelect });
  });
  return serializeAnnouncement(announcement);
}

export async function updateGlobalAnnouncement(id: string, input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const data = parseAnnouncementInput(input);
  if (data.audience === "TENANT" && !(await db.church.findFirst({ where: { id: data.churchId!, status: "ACTIVE" }, select: { id: true } }))) throw new Error("The selected tenant is not active.");
  const announcement = await db.$transaction(async (transaction) => {
    const updated = await transaction.globalAnnouncement.update({ where: { id }, data, select: announcementSelect });
    await transaction.globalAnnouncementDelivery.deleteMany({ where: { announcementId: id } });
    const churches = await transaction.church.findMany({ where: data.audience === "TENANT" ? { id: data.churchId!, status: "ACTIVE" } : { status: "ACTIVE" }, select: { id: true } });
    if (churches.length) {
      await transaction.globalAnnouncementDelivery.createMany({
        data: churches.map((church) => ({ announcementId: id, churchId: church.id })),
        skipDuplicates: true
      });
    }
    await transaction.auditLog.create({
      data: {
        activityType: "global-admin-announcement-updated",
        summary: `Updated global announcement "${data.title}".`,
        actorId: context.user.id,
        details: buildGlobalAuditDetails({ churchId: churches[0]?.id ?? "platform", targetType: "global-announcement", targetId: id, metadata: { audience: data.audience, placement: data.placement, severity: data.severity, deliveryCount: churches.length } })
      }
    });
    return updated;
  });
  return serializeAnnouncement(announcement);
}

export async function deleteGlobalAnnouncement(id: string) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const deleted = await db.$transaction(async (transaction) => {
    const announcement = await transaction.globalAnnouncement.delete({ where: { id }, select: { id: true, title: true } });
    await transaction.auditLog.create({
      data: {
        activityType: "global-admin-announcement-deleted",
        summary: `Deleted global announcement "${announcement.title}".`,
        actorId: context.user.id,
        details: buildGlobalAuditDetails({ churchId: "platform", targetType: "global-announcement", targetId: id })
      }
    });
    return announcement;
  });
  return deleted;
}
