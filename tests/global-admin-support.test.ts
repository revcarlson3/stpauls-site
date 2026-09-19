import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  church: { findUnique: vi.fn() },
  supportTicket: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  supportTicketMessage: { create: vi.fn() },
  supportTicketAttachment: { createMany: vi.fn(), findFirst: vi.fn() },
  user: { findFirst: vi.fn() }
}));
const requireGlobalAdmin = vi.hoisted(() => vi.fn());
const logAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({
  requireGlobalAdmin,
  buildGlobalAuditDetails: (input: { churchId: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> }) => JSON.stringify({ boundary: "global-admin", selectedChurchId: input.churchId, targetType: input.targetType, targetId: input.targetId ?? null, metadata: input.metadata ?? {} })
}));
vi.mock("@/lib/audit", () => ({ logAudit }));

describe("global-admin support management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGlobalAdmin.mockResolvedValue({ user: { id: "admin-1" }, church: { id: "church-1" } });
    db.church.findUnique.mockResolvedValue({ id: "church-1", name: "Selected", status: "ACTIVE", lifecycleStatus: "ACTIVE" });
  });

  it("serializes ticket details without dropping internal note privacy", async () => {
    const { serializeSupportTicket } = await import("@/lib/global-admin-support");
    const result = serializeSupportTicket({
      id: "ticket-1",
      subject: "Help",
      description: "Private description",
      status: "OPEN",
      priority: "HIGH",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      closedAt: null,
      assignedTo: null,
      messages: [{ id: "message-1", body: "Internal", isInternal: true, createdAt: new Date("2026-01-03T00:00:00.000Z"), author: { id: "admin-1", name: "Admin", email: "admin@example.com" }, attachments: [{ id: "attachment-1", originalName: "evidence.txt", mimeType: "text/plain", sizeBytes: 12 }] }]
    });
    expect(result).toMatchObject({ id: "ticket-1", description: "Private description", messages: [{ body: "Internal", isInternal: true, createdAt: "2026-01-03T00:00:00.000Z", attachments: [{ id: "attachment-1", originalName: "evidence.txt", mimeType: "text/plain", sizeBytes: 12 }] }] });
  });

  it("lists only the selected site and rejects invalid filters", async () => {
    db.supportTicket.findMany.mockResolvedValue([]);
    const { listSelectedSiteSupportTickets } = await import("@/lib/global-admin-support");
    await listSelectedSiteSupportTickets("OPEN");
    expect(db.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { churchId: "church-1", status: "OPEN" } }));
    await expect(listSelectedSiteSupportTickets("NOT_A_STATUS")).rejects.toThrow("Support ticket fields are invalid.");
  });

  it("updates status, priority, assignment, and notes with a privacy-safe audit record", async () => {
    db.user.findFirst.mockResolvedValue({ id: "platform-admin-2" });
    db.supportTicket.findFirst
      .mockResolvedValueOnce({ id: "ticket-1", subject: "Help", status: "OPEN", priority: "NORMAL", assignedToId: null })
      .mockResolvedValueOnce({ id: "ticket-1", subject: "Help", status: "IN_PROGRESS", priority: "URGENT", assignedToId: "platform-admin-2" });
    db.supportTicket.update.mockResolvedValue({
      id: "ticket-1",
      subject: "Help",
      description: "Description",
      status: "IN_PROGRESS",
      priority: "URGENT",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      closedAt: null,
      assignedTo: { id: "platform-admin-2", name: "Support", email: "support@example.com" },
      createdBy: { id: "user-1", name: "Tenant", email: "tenant@example.com" },
      messages: []
    });
    const { updateSelectedSiteSupportTicket } = await import("@/lib/global-admin-support");
    const result = await updateSelectedSiteSupportTicket("ticket-1", { status: "IN_PROGRESS", priority: "URGENT", assignedToId: "platform-admin-2", internalNote: "Investigating privately." });
    expect(result).toMatchObject({ id: "ticket-1", status: "IN_PROGRESS", priority: "URGENT" });
    expect(db.supportTicket.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ticket-1" }, data: expect.objectContaining({ status: "IN_PROGRESS", priority: "URGENT", assignedToId: "platform-admin-2" }) }));
    expect(db.supportTicketMessage.create).toHaveBeenCalledWith({ data: { ticketId: "ticket-1", authorId: "admin-1", body: "Investigating privately.", isInternal: true } });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ activityType: "global-admin-support-note-added", details: expect.stringContaining('"selectedChurchId":"church-1"') }));
    expect(logAudit.mock.calls[0][0].details).not.toContain("Investigating privately.");
  });

  it("blocks mutations for an inactive selected site", async () => {
    db.church.findUnique.mockResolvedValue({ id: "church-1", name: "Selected", status: "SUSPENDED", lifecycleStatus: "SUSPENDED" });
    const { updateSelectedSiteSupportTicket } = await import("@/lib/global-admin-support");
    await expect(updateSelectedSiteSupportTicket("ticket-1", { status: "CLOSED" })).rejects.toThrow("The selected site is not active.");
  });

  it("adds a tenant-visible reply only within the selected active site", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "ticket-1", churchId: "church-1", status: "OPEN" });
    db.supportTicketMessage.create.mockResolvedValue({ id: "message-1" });
    const { addSelectedSiteSupportReply } = await import("@/lib/global-admin-support");
    await expect(addSelectedSiteSupportReply("ticket-1", "A public response.", [])).resolves.toBe("message-1");
    expect(db.supportTicketMessage.create).toHaveBeenCalledWith({ data: { ticketId: "ticket-1", authorId: "admin-1", body: "A public response.", isInternal: false }, select: { id: true } });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ activityType: "global-admin-support-reply-added", details: expect.stringContaining("support-ticket-public-reply") }));
    expect(logAudit.mock.calls.at(-1)?.[0].details).not.toContain("A public response.");
  });

  it("rejects a malformed public reply before creating a message", async () => {
    const { addSelectedSiteSupportReply } = await import("@/lib/global-admin-support");
    await expect(addSelectedSiteSupportReply("ticket-1", "   ", [])).rejects.toThrow("Support reply is invalid.");
    expect(db.supportTicketMessage.create).not.toHaveBeenCalled();
  });
});
