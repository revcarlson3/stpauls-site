import { NextResponse } from "next/server";
import { requireSupportUser, readSupportFile, ticketWhere } from "@/lib/support";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSupportUser();
    const attachment = await db.supportTicketAttachment.findFirst({ where: { id: params.id, ticket: ticketWhere(user) }, select: { storedName: true, mimeType: true, originalName: true } });
    if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    const data = await readSupportFile(attachment.storedName);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `attachment; filename="${attachment.originalName.replace(/["\r\n]/g, "")}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
}
