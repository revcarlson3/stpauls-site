import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { interpolateMessage, sanitizeEmailHtml } from "@/lib/membership-messaging";
import { sendMembershipEmail, sendSmsText } from "@/lib/membership-delivery";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const messageId = typeof input?.messageId === "string" ? input.messageId.trim() : "";
    if (!messageId) return NextResponse.json({ error: "Message is required." }, { status: 400 });
    const message = await db.membershipMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true, channel: true, subject: true, bodyHtml: true, bodyText: true,
        attachments: { select: { fileName: true, contentBase64: true, mimeType: true } },
        recipients: { where: { status: "FAILED" }, select: { id: true, individualId: true, address: true, displayName: true, individual: { select: { firstName: true, lastName: true, family: { select: { lastName: true, addressCity: true } } } } } }
      }
    });
    if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { siteName: true } });
    const results = await Promise.all(message.recipients.map(async (recipient) => {
      const attemptedAt = new Date();
      await db.membershipMessageRecipient.update({ where: { id: recipient.id }, data: { status: "PENDING", attemptCount: { increment: 1 }, lastAttemptAt: attemptedAt, failureReason: null } });
      try {
        const lastName = recipient.individual.lastName ?? recipient.individual.family?.lastName ?? "";
        const context = { firstName: recipient.individual.firstName, lastName, familyName: recipient.individual.family?.lastName ?? lastName, formalGreeting: `Dear ${recipient.individual.firstName} ${lastName}`.trim(), informalGreeting: `Hi ${recipient.individual.firstName}`.trim(), city: recipient.individual.family?.addressCity ?? "", churchName: settings?.siteName?.trim() || "St. Paul's", currentYear: String(new Date().getFullYear()) };
        const subject = interpolateMessage(message.subject ?? "", context.firstName, context.lastName, context);
        const bodyText = interpolateMessage(message.bodyText, context.firstName, context.lastName, context);
        const bodyHtml = sanitizeEmailHtml(interpolateMessage(message.bodyHtml, context.firstName, context.lastName, Object.fromEntries(Object.entries(context).map(([key, value]) => [key, escapeHtml(value)]))));
        if (message.channel === "EMAIL") await sendMembershipEmail({ recipient: recipient.address, subject, bodyHtml, bodyText, attachments: message.attachments.filter((attachment): attachment is { fileName: string; contentBase64: string; mimeType: string } => Boolean(attachment.contentBase64)).map((attachment) => ({ fileName: attachment.fileName, contentBase64: attachment.contentBase64!, contentType: attachment.mimeType })) });
        else await sendSmsText(recipient.address, bodyText);
        await db.membershipMessageRecipient.update({ where: { id: recipient.id }, data: { status: "SENT", deliveredAt: new Date(), failureReason: null } });
        await db.membershipMessageDeliveryAttempt.create({ data: { recipientId: recipient.id, status: "SENT", attemptedAt } });
        return true;
      } catch (reason) {
        const error = reason instanceof Error ? reason.message : "Delivery failed.";
        await db.membershipMessageRecipient.update({ where: { id: recipient.id }, data: { status: "FAILED", failureReason: error.slice(0, 1000) } });
        await db.membershipMessageDeliveryAttempt.create({ data: { recipientId: recipient.id, status: "FAILED", error: error.slice(0, 1000), attemptedAt } });
        return false;
      }
    }));
    const retried = results.length;
    const sent = results.filter(Boolean).length;
    const remaining = await db.membershipMessageRecipient.count({ where: { messageId, status: "FAILED" } });
    const status = remaining === 0 ? "SENT" : sent === 0 ? "FAILED" : "QUEUED";
    const deliveryNote = `${sent} retried successfully; ${remaining} failed recipient${remaining === 1 ? "" : "s"} remain.`;
    await db.membershipMessage.update({ where: { id: messageId }, data: { status, deliveryNote } });
    return NextResponse.json({ retried, sent, remaining, status, deliveryNote });
  } catch {
    return NextResponse.json({ error: "Unable to retry failed recipients." }, { status: 500 });
  }
}
