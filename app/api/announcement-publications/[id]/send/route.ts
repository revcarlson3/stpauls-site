import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { htmlToText, sanitizeEmailHtml } from "@/lib/membership-messaging";
import { sendMembershipEmail } from "@/lib/membership-delivery";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!user.churchId) throw new Error("A church membership is required.");
    const publication = await db.announcementPublication.findFirst({ where: { id: params.id, churchId: user.churchId, status: "PUBLISHED" }, select: { id: true, title: true, bodyHtml: true, emailDelivery: { select: { status: true } } } });
    if (!publication) return NextResponse.json({ error: "A published publication is required before sending email." }, { status: 400 });
    if (publication.emailDelivery?.status === "SENT" || publication.emailDelivery?.status === "SENDING") return NextResponse.json({ error: "This publication has already been sent or is currently sending." }, { status: 409 });
    const members = await db.membershipIndividual.findMany({ where: { churchId: user.churchId, status: "ACTIVE", email: { not: null }, emailMessagesAllowed: true, doNotContact: false }, select: { email: true } });
    const recipients = Array.from(new Set(members.map((member) => member.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email))));
    if (!recipients.length) return NextResponse.json({ error: "No active members have an email address and opted in to email messages." }, { status: 400 });
    const delivery = await db.announcementEmailDelivery.create({ data: { publicationId: publication.id, status: "SENDING", recipientCount: recipients.length } });
    const bodyHtml = sanitizeEmailHtml(publication.bodyHtml);
    const bodyText = htmlToText(bodyHtml);
    const results = await Promise.all(recipients.map(async (recipient) => {
      try {
        await sendMembershipEmail({ recipient, subject: publication.title, bodyHtml, bodyText, attachments: [], fromName: "St. Paul's" });
        return true;
      } catch {
        return false;
      }
    }));
    const sentCount = results.filter(Boolean).length;
    const failedCount = results.length - sentCount;
    const status = sentCount === recipients.length ? "SENT" : sentCount ? "PARTIAL" : "FAILED";
    const updated = await db.announcementEmailDelivery.update({ where: { id: delivery.id }, data: { status, sentCount, failedCount, completedAt: new Date(), note: `${sentCount} delivered; ${failedCount} failed.` } });
    return NextResponse.json({ delivery: updated, recipientCount: recipients.length }, { status: status === "FAILED" ? 502 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send announcement email." }, { status: 400 });
  }
}
