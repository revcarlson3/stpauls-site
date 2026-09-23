import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";
import { readSupportFile, removeSupportFiles, saveSupportFiles, validateSupportFiles } from "@/lib/support";
import { notifySupportCreatorOfPublicReply } from "@/lib/support-notifications";
import type { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";

export const supportTicketStatuses = ["OPEN", "IN_PROGRESS", "WAITING_ON_TENANT", "RESOLVED", "CLOSED"] as const;
export const supportTicketPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
type TicketStatus = (typeof supportTicketStatuses)[number];
type TicketPriority = (typeof supportTicketPriorities)[number];

const ticketListSelect = {
  id: true,
  subject: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  church: { select: { id: true, name: true, slug: true } }
} as const;

function serializeAssignee(assignedTo: { id: string; name: string; email: string } | null) {
  return assignedTo ? { id: assignedTo.id, name: assignedTo.name, email: assignedTo.email } : null;
}

export function serializeSupportTicket(ticket: {
  id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  closedAt?: Date | string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
  church?: { id: string; name: string; slug?: string } | null;
  messages?: Array<{ id: string; body: string; isInternal: boolean; createdAt: Date | string; author: { id: string; name: string; email: string }; attachments?: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: number }> }>;
}) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    ...(ticket.description !== undefined ? { description: ticket.description } : {}),
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.toISOString() : ticket.createdAt,
    updatedAt: ticket.updatedAt instanceof Date ? ticket.updatedAt.toISOString() : ticket.updatedAt,
    closedAt: ticket.closedAt instanceof Date ? ticket.closedAt.toISOString() : (ticket.closedAt ?? null),
    assignedTo: serializeAssignee(ticket.assignedTo),
    ...(ticket.createdBy ? { createdBy: serializeAssignee(ticket.createdBy) } : {}),
    ...(ticket.church ? { originatingTenant: { id: ticket.church.id, name: ticket.church.name, ...(ticket.church.slug ? { slug: ticket.church.slug } : {}) } } : {}),
    ...(ticket.messages ? {
      messages: ticket.messages.map((message) => ({
        id: message.id,
        body: message.body,
        isInternal: message.isInternal,
        createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
        author: serializeAssignee(message.author),
        ...(message.attachments ? { attachments: message.attachments.map((attachment) => ({ id: attachment.id, originalName: attachment.originalName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes })) } : {})
      }))
    } : {})
  };
}

function assertEnum(value: unknown, values: readonly string[]) {
  return typeof value === "string" && values.includes(value);
}

async function requireActiveSupportContext() {
  const context = await requireGlobalAdmin({ sensitive: true, selectedChurch: true });
  const church = await db.church.findUnique({ where: { id: context.church!.id }, select: { id: true, status: true, lifecycleStatus: true } });
  if (!church || church.status !== "ACTIVE" || church.lifecycleStatus !== "ACTIVE") throw new Error("The selected site is not active.");
  return context;
}

export async function listSelectedSiteSupportTickets(status?: string, platformWide = false) {
  const context = await requireGlobalAdmin(platformWide ? {} : { selectedChurch: true });
  if (status && !assertEnum(status, supportTicketStatuses)) throw new Error("Support ticket fields are invalid.");
  const tickets = await db.supportTicket.findMany({
    where: { ...(platformWide ? {} : { churchId: context.church!.id }), ...(status ? { status: status as SupportTicketStatus } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: ticketListSelect
  });
  return tickets.map(serializeSupportTicket);
}

export async function getSelectedSiteSupportTicket(ticketId: string, platformWide = false) {
  const context = await requireGlobalAdmin(platformWide ? {} : { selectedChurch: true });
  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, ...(platformWide ? {} : { churchId: context.church!.id }) },
    select: {
      ...ticketListSelect,
      description: true,
      createdBy: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, isInternal: true, createdAt: true, author: { select: { id: true, name: true, email: true } }, attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } } }
    }

  });
  return ticket ? serializeSupportTicket(ticket) : null;
}

export async function addSelectedSiteSupportReply(ticketId: string, body: string, files: File[], platformWide = false) {
  const context = platformWide ? await requireGlobalAdmin({ sensitive: true }) : await requireActiveSupportContext();
  const trimmedBody = body.trim();
  if (!trimmedBody || trimmedBody.length > 10_000) throw new Error("Support reply is invalid.");
  validateSupportFiles(files);
  const existing = await db.supportTicket.findFirst({
    where: { id: ticketId, ...(platformWide ? {} : { churchId: context.church!.id }) },
    select: { id: true, churchId: true, status: true }
  });
  if (!existing) return null;
  const saved = await saveSupportFiles(files);
  try {
    const message = await db.supportTicketMessage.create({
      data: { ticketId: existing.id, authorId: context.user.id, body: trimmedBody, isInternal: false },
      select: { id: true }
    });
    if (saved.length) {
      await db.supportTicketAttachment.createMany({
        data: saved.map((attachment) => ({ ...attachment, ticketId: existing.id, messageId: message.id }))
      });
    }
    await db.supportTicket.update({
      where: { id: existing.id },
      data: { status: existing.status === "CLOSED" ? "OPEN" : "IN_PROGRESS" }
    });
    await notifySupportCreatorOfPublicReply({ ticketId: existing.id, body: trimmedBody, senderId: context.user.id }).catch((error) => {
      console.error("Support creator notification failed.", error);
    });
    await logAudit({
      activityType: "global-admin-support-reply-added",
      summary: `Added a public reply to support ticket ${existing.id}.`,
      actorId: context.user.id,
      details: buildGlobalAuditDetails({
        churchId: existing.churchId,
        targetType: "support-ticket-public-reply",
        targetId: existing.id,
        metadata: { attachmentCount: saved.length }
      })
    });
    return message.id;
  } catch (error) {
    await removeSupportFiles(saved);
    throw error;
  }
}

export async function getSelectedSiteSupportAttachment(attachmentId: string) {
  const context = await requireGlobalAdmin();
  const attachment = await db.supportTicketAttachment.findFirst({
    where: { id: attachmentId },
    select: { id: true, storedName: true, mimeType: true, originalName: true, ticketId: true, ticket: { select: { churchId: true } } }
  });
  if (!attachment) return null;
  const data = await readSupportFile(attachment.storedName);
  await logAudit({
    activityType: "support-attachment-downloaded",
    summary: `Downloaded a support attachment for ticket ${attachment.ticketId}.`,
    actorId: context.user.id,
    details: buildGlobalAuditDetails({
      churchId: attachment.ticket.churchId,
      targetType: "support-ticket-attachment",
      targetId: attachment.id
    })
  });
  return { id: attachment.id, storedName: attachment.storedName, mimeType: attachment.mimeType, originalName: attachment.originalName, ticketId: attachment.ticketId, data };
}

export async function listSupportAssignees() {
  await requireGlobalAdmin();
  return db.user.findMany({ where: { isActive: true, isPlatformAdmin: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function updateSelectedSiteSupportTicket(ticketId: string, input: Record<string, unknown>, platformWide = false) {
  const context = platformWide ? await requireGlobalAdmin({ sensitive: true }) : await requireActiveSupportContext();
  const status = input.status;
  const priority = input.priority;
  const assignedToId = input.assignedToId;
  const note = input.internalNote;
  if (status !== undefined && !assertEnum(status, supportTicketStatuses)) throw new Error("Support ticket fields are invalid.");
  if (priority !== undefined && !assertEnum(priority, supportTicketPriorities)) throw new Error("Support ticket fields are invalid.");
  if (assignedToId !== undefined && assignedToId !== null && (typeof assignedToId !== "string" || !assignedToId)) throw new Error("Support ticket fields are invalid.");
  if (note !== undefined && (typeof note !== "string" || note.trim().length === 0 || note.length > 10_000)) throw new Error("Support ticket fields are invalid.");
  if (assignedToId) {
    const assignee = await db.user.findFirst({ where: { id: assignedToId, isActive: true, isPlatformAdmin: true }, select: { id: true } });
    if (!assignee) throw new Error("The assignee must be an active platform administrator.");
  }
  const existing = await db.supportTicket.findFirst({ where: { id: ticketId, ...(platformWide ? {} : { churchId: context.church!.id }) }, select: { id: true, subject: true, status: true, priority: true, assignedToId: true, churchId: true } });
  if (!existing) return null;
  if (status === undefined && priority === undefined && assignedToId === undefined && note === undefined) throw new Error("Support ticket fields are invalid.");

  const updated = await db.supportTicket.update({
    where: { id: existing.id },
    data: {
      ...(status !== undefined ? { status: status as SupportTicketStatus, closedAt: status === "CLOSED" ? new Date() : null } : {}),
      ...(priority !== undefined ? { priority: priority as SupportTicketPriority } : {}),
      ...(assignedToId !== undefined ? { assignedToId: assignedToId as string | null } : {})
    },
    select: {
      ...ticketListSelect,
      description: true,
      createdBy: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, isInternal: true, createdAt: true, author: { select: { id: true, name: true, email: true } } } }
    }
  });
  if (note !== undefined) {
    await db.supportTicketMessage.create({ data: { ticketId: existing.id, authorId: context.user.id, body: note.trim(), isInternal: true } });
  }
  await logAudit({
    activityType: note !== undefined ? "global-admin-support-note-added" : "global-admin-support-ticket-updated",
    summary: note !== undefined ? `Added an internal note to support ticket ${existing.id}.` : `Updated support ticket ${existing.id}.`,
    actorId: context.user.id,
    details: buildGlobalAuditDetails({
      churchId: existing.churchId,
      targetType: "support-ticket",
      targetId: existing.id,
      metadata: {
        changedFields: [status !== undefined ? "status" : null, priority !== undefined ? "priority" : null, assignedToId !== undefined ? "assignment" : null, note !== undefined ? "internal-note" : null].filter(Boolean),
        status: status ?? existing.status,
        priority: priority ?? existing.priority,
        assigned: assignedToId !== undefined
      }
    })
  });
  return serializeSupportTicket(updated);
}
