import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSupportUser, removeSupportFiles, saveSupportFiles, serializeTicket, ticketWhere, validateSupportFiles } from "@/lib/support";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSupportUser();
    const ticket = await serializeTicket(params.id, user);
    if (user.isPlatformAdmin) await logAudit({ activityType: "support-ticket-viewed", summary: `Viewed support ticket ${ticket.id}.`, actorId: user.id, details: JSON.stringify({ ticketId: ticket.id, churchId: ticket.churchId }) });
    return NextResponse.json(ticket);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message.startsWith("Not found:") ? "Support ticket not found." : "Unable to load support ticket." }, { status: message.startsWith("Unauthorized:") ? 401 : message.startsWith("Not found:") ? 404 : 403 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSupportUser();
    const ticket = await db.supportTicket.findFirst({ where: { id: params.id, ...ticketWhere(user) }, select: { id: true, churchId: true, status: true } });
    if (!ticket) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const input = form ? null : await request.json().catch(() => null);
    const body = String(form?.get("body") ?? input?.body ?? "").trim();
    const files = form ? form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0) : [];
    if (!body || body.length > 10_000) return NextResponse.json({ error: "Enter a reply." }, { status: 400 });
    validateSupportFiles(files);
    const saved = await saveSupportFiles(files);
    try {
      const message = await db.supportTicketMessage.create({ data: { ticketId: ticket.id, authorId: user.id, body }, select: { id: true } });
      if (saved.length) await db.supportTicketAttachment.createMany({ data: saved.map((attachment) => ({ ...attachment, ticketId: ticket.id, messageId: message.id })) });
      await db.supportTicket.update({ where: { id: ticket.id }, data: { status: ticket.status === "CLOSED" ? "OPEN" : "IN_PROGRESS" } });
      if (user.isPlatformAdmin) await logAudit({ activityType: "support-ticket-replied", summary: `Replied to support ticket ${ticket.id}.`, actorId: user.id, details: JSON.stringify({ ticketId: ticket.id, churchId: ticket.churchId, attachmentCount: saved.length }) });
      return NextResponse.json({ id: message.id }, { status: 201 });
    } catch (error) {
      await removeSupportFiles(saved);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.startsWith("Unauthorized:") ? 401 : message.includes("Attachments") || message.includes("reply") ? 400 : 403;
    return NextResponse.json({ error: status === 403 ? "Unable to reply to support ticket." : message.replace(/^Unauthorized: /, "") }, { status });
  }
}
