import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSupportUser, removeSupportFiles, saveSupportFiles, ticketWhere, validateSupportFiles } from "@/lib/support";
import { notifySupportAdminsOfNewTicket } from "@/lib/support-notifications";

export async function GET(request: Request) {
  try {
    const user = await requireSupportUser();
    const url = new URL(request.url);
    const tickets = await db.supportTicket.findMany({
      where: ticketWhere(user, url.searchParams.get("churchId") ?? undefined),
      orderBy: { updatedAt: "desc" },
      select: { id: true, subject: true, description: true, status: true, createdAt: true, updatedAt: true, createdBy: { select: { id: true, name: true } }, _count: { select: { messages: true, attachments: true } } },
    });
    return NextResponse.json({ tickets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Unauthorized:") ? "Sign-in required." : "Unable to load support tickets." }, { status: error instanceof Error && error.message.startsWith("Unauthorized:") ? 401 : 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupportUser(true);
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const input = form ? null : await request.json().catch(() => null);
    const subject = String(form?.get("subject") ?? input?.subject ?? "").trim();
    const description = String(form?.get("description") ?? input?.description ?? "").trim();
    const churchId = String(form?.get("churchId") ?? input?.churchId ?? user.churchId ?? "").trim();
    const files = form ? form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0) : [];
    if (!subject || subject.length > 200 || !description || description.length > 10_000) return NextResponse.json({ error: "Enter a subject and description." }, { status: 400 });
    validateSupportFiles(files);
    const saved = await saveSupportFiles(files);
    if (!churchId) return NextResponse.json({ error: "A church is required." }, { status: 400 });
    if (!user.isPlatformAdmin && churchId !== user.churchId) return NextResponse.json({ error: "You cannot create a ticket for another church." }, { status: 403 });
    const church = await db.church.findFirst({ where: { id: churchId, status: "ACTIVE" }, select: { id: true } });
    if (!church) return NextResponse.json({ error: "The selected church is unavailable." }, { status: 400 });
    try {
      const ticket = await db.supportTicket.create({
        data: {
          churchId,
          createdById: user.id,
          subject,
          description,
          attachments: { create: saved },
        },
        select: { id: true, status: true },
      });
      await notifySupportAdminsOfNewTicket({ ticketId: ticket.id }).catch((error) => {
        console.error("Support ticket administrator notification failed.", error);
      });
      return NextResponse.json(ticket, { status: 201 });
    } catch (error) {
      await removeSupportFiles(saved);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.startsWith("Unauthorized:") ? 401 : message.startsWith("Forbidden:") ? 403 : message.includes("Attachments") || message.includes("Enter") ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to create support ticket." : message.replace(/^(Unauthorized|Forbidden): /, "") }, { status });
  }
}
