import { NextResponse } from "next/server";
import { requireSupportUser, readSupportFile, ticketWhere } from "@/lib/support";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSupportUser();
    const attachment = await db.supportTicketAttachment.findFirst({ where: { id: params.id, ticket: ticketWhere(user) }, select: { storedName: true, mimeType: true, originalName: true } });
    if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    const data = await readSupportFile(attachment.storedName);
    if (user.isPlatformAdmin) await logAudit({ activityType: "support-attachment-downloaded", summary: `Downloaded support attachment ${attachment.originalName}.`, actorId: user.id, details: JSON.stringify({ attachmentId: params.id }) });
    return new Response(new Uint8Array(data), { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `attachment; filename="${attachment.originalName.replace(/["\r\n]/g, "")}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
}
