import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  supportTicket: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  reportAutomationNotification: { create: vi.fn() }
}));
const sendMembershipEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/membership-delivery", () => ({ sendMembershipEmail }));

describe("support notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails every active platform administrator for a new ticket", async () => {
    db.supportTicket.findUnique.mockResolvedValue({ id: "ticket-1", subject: "Help", description: "Need help", church: { name: "Church" }, createdBy: { id: "user-1", name: "Tenant", email: "tenant@example.com" } });
    db.user.findMany.mockResolvedValue([{ email: "one@example.com" }, { email: "two@example.com" }]);
    const { notifySupportAdminsOfNewTicket } = await import("@/lib/support-notifications");
    await notifySupportAdminsOfNewTicket({ ticketId: "ticket-1" });
    expect(db.user.findMany).toHaveBeenCalledWith({ where: { isActive: true, isPlatformAdmin: true }, select: { email: true } });
    expect(sendMembershipEmail).toHaveBeenCalledTimes(2);
  });

  it("emails and bells the creator for a public reply", async () => {
    db.supportTicket.findUnique.mockResolvedValue({ id: "ticket-1", subject: "Help", description: "Need help", church: { name: "Church" }, createdBy: { id: "user-1", name: "Tenant", email: "tenant@example.com" } });
    const { notifySupportCreatorOfPublicReply } = await import("@/lib/support-notifications");
    await notifySupportCreatorOfPublicReply({ ticketId: "ticket-1", body: "Resolved.", senderId: "admin-1" });
    expect(sendMembershipEmail).toHaveBeenCalledWith(expect.objectContaining({ recipient: "tenant@example.com", subject: "Support ticket reply: Help" }));
    expect(db.reportAutomationNotification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user-1", senderId: "admin-1", link: "/account/support/ticket-1", category: "SUPPORT" }) });
  });
});
