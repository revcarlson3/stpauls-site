import { db } from "@/lib/db";
import { sendMembershipEmail } from "@/lib/membership-delivery";

type SupportNotificationTicket = {
  id: string;
  subject: string;
  description: string;
  church: { name: string };
  createdBy: { id: string; name: string; email: string };
};

async function getTicket(ticketId: string): Promise<SupportNotificationTicket | null> {
  return db.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      subject: true,
      description: true,
      church: { select: { name: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function notifySupportAdminsOfNewTicket(input: { ticketId: string }) {
  const ticket = await getTicket(input.ticketId);
  if (!ticket) return;
  const recipients = await db.user.findMany({
    where: { isActive: true, isPlatformAdmin: true },
    select: { email: true }
  });
  await Promise.all(recipients.map((recipient) => sendMembershipEmail({
    recipient: recipient.email,
    subject: `New support ticket: ${ticket.subject}`,
    bodyText: `A new support ticket was submitted by ${ticket.createdBy.name} for ${ticket.church.name}.\n\nSubject: ${ticket.subject}\n\n${ticket.description}`,
    bodyHtml: `<p>A new support ticket was submitted by ${escapeHtml(ticket.createdBy.name)} for ${escapeHtml(ticket.church.name)}.</p><p><strong>${escapeHtml(ticket.subject)}</strong></p><p>${escapeHtml(ticket.description).replace(/\n/g, "<br>")}</p>`,
    attachments: []
  })));
}

export async function notifySupportCreatorOfPublicReply(input: { ticketId: string; body: string; senderId: string }) {
  const ticket = await getTicket(input.ticketId);
  if (!ticket) return;
  await Promise.all([
    sendMembershipEmail({
      recipient: ticket.createdBy.email,
      subject: `Support ticket reply: ${ticket.subject}`,
      bodyText: `A support administrator replied to your ticket "${ticket.subject}".\n\n${input.body}`,
      bodyHtml: `<p>A support administrator replied to your ticket <strong>${escapeHtml(ticket.subject)}</strong>.</p><p>${escapeHtml(input.body).replace(/\n/g, "<br>")}</p>`,
      attachments: []
    }),
    db.reportAutomationNotification.create({
      data: {
        userId: ticket.createdBy.id,
        senderId: input.senderId,
        title: "Support ticket reply",
        message: `A support administrator replied to “${ticket.subject}”.`,
        link: `/account/support/${ticket.id}`,
        category: "SUPPORT"
      }
    })
  ]);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
