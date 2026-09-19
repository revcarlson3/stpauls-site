import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const auditActivityTypes = ["report-automation-created", "report-automation-updated", "report-automation-deleted", "report-automation-run", "notification-sent", "notification-deleted", "user-created", "user-updated", "user-deleted", "invitation-created", "invitation-accepted", "invitation-resent", "invitation-revoked", "email-change-requested", "email-changed", "sessions-revoked", "group-created", "group-updated", "group-deleted", "view-as-changed", "global-admin-context-selected", "global-admin-site-identity-updated", "membership-family-created", "membership-family-updated", "membership-family-removed", "membership-individual-created", "membership-individual-updated", "membership-individual-removed", "membership-import-committed", "membership-note-created", "membership-note-updated", "membership-note-deleted", "membership-document-uploaded", "membership-document-downloaded", "membership-form-submitted", "membership-document-retention-updated", "membership-document-deleted", "membership-message-created", "membership-message-template-created", "membership-message-template-updated", "membership-message-template-deleted", "membership-event-created", "membership-event-updated", "membership-event-deleted", "membership-event-volunteer-assignment-updated", "membership-attendance-recorded", "membership-service-opportunity-created", "membership-service-shift-created", "membership-service-shift-updated", "membership-service-shift-deleted", "membership-service-recorded", "ai-image-generated"] as const;
export type AuditActivityType = (typeof auditActivityTypes)[number];

export async function logAudit(input: { activityType: AuditActivityType; summary: string; details?: string; actorId?: string }) {
  try {
    await db.auditLog.create({ data: input });
  } catch (error) {
    console.error("Audit log entry could not be written.", error);
  }
}

export async function listAuditLogs(activityType?: string) {
  await requirePermission("ACCESS_ADMIN");
  return db.auditLog.findMany({
    where: activityType && auditActivityTypes.includes(activityType as AuditActivityType) ? { activityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, activityType: true, summary: true, details: true, createdAt: true, actor: { select: { name: true, email: true } } }
  });
}
