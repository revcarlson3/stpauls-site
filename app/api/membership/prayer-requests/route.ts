import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { getPrayerRequestSettings } from "@/lib/app-config";
import { sendMembershipEmail } from "@/lib/membership-delivery";

function addresses(value: string) {
  return value.split(/[;,]/).map((item) => item.trim()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

export async function GET() {
  const requests = await db.prayerRequest.findMany({
    where: { status: "APPROVED", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, submitterName: true, request: true, includeInSundayPrayers: true, createdAt: true, expiresAt: true }
  });
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const text = typeof input?.request === "string" ? input.request.trim() : "";
  const durationDays = Number(input?.durationDays);
  if (!text || text.length > 500 || ![7, 30, 90, 365].includes(durationDays) || typeof input?.includeInSundayPrayers !== "boolean" || typeof input?.requestPastoralContact !== "boolean") {
    return NextResponse.json({ error: "Please provide a request of 500 characters or fewer and valid notification choices." }, { status: 400 });
  }
  const expiresAt = new Date(Date.now() + durationDays * 86400000);
  const created = await db.prayerRequest.create({ data: { submitterId: user.id, submitterName: user.name, request: text, expiresAt, includeInSundayPrayers: input.includeInSundayPrayers, requestPastoralContact: input.requestPastoralContact } });
  const configured = await getPrayerRequestSettings();
  let adminRecipients = addresses(configured.adminEmail);
  if (!adminRecipients.length) {
    const admins = await db.user.findMany({ where: { isActive: true, role: { in: ["admin", "editor"] } }, select: { email: true } });
    adminRecipients = admins.map((admin) => admin.email).filter(Boolean);
  }
  const link = `${process.env.NEXTAUTH_URL ?? ""}/admin/membership/prayer-requests`;
  if (adminRecipients.length) {
    await Promise.allSettled(adminRecipients.map((recipient) => sendMembershipEmail({ recipient, subject: "Prayer request awaiting approval", bodyText: `${user.name} submitted a prayer request awaiting approval.\n\n${text}\n\nReview securely: ${link}`, bodyHtml: `<p><strong>${user.name}</strong> submitted a prayer request awaiting approval.</p><blockquote>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</blockquote><p><a href="${link}">Review prayer requests</a></p>`, attachments: [] })));
  }
  return NextResponse.json({ id: created.id, status: created.status }, { status: 201 });
}

export async function PATCH(request: Request) {
  try {
    const reviewer = await requirePermission("MANAGE_MEMBERSHIP");
    const input = await request.json().catch(() => null);
    if (typeof input?.id !== "string") return NextResponse.json({ error: "Invalid prayer request." }, { status: 400 });
    if (input.action === "edit") {
      const text = typeof input.request === "string" ? input.request.trim() : "";
      const expiresAt = new Date(input.expiresAt);
      if (!text || text.length > 500 || Number.isNaN(expiresAt.getTime()) || typeof input.includeInSundayPrayers !== "boolean" || typeof input.requestPastoralContact !== "boolean") {
        return NextResponse.json({ error: "Enter a request of 500 characters or fewer, a valid expiration date, and both notification choices." }, { status: 400 });
      }
      const item = await db.prayerRequest.update({ where: { id: input.id }, data: { request: text, expiresAt, includeInSundayPrayers: input.includeInSundayPrayers, requestPastoralContact: input.requestPastoralContact, expirationNotifiedAt: null } });
      return NextResponse.json({ request: item });
    }
    if (!["APPROVED", "DECLINED"].includes(input.status)) return NextResponse.json({ error: "Invalid review." }, { status: 400 });
    const item = await db.prayerRequest.update({ where: { id: input.id }, data: { status: input.status, reviewedAt: new Date(), reviewedById: reviewer.id } });
    if (input.status === "APPROVED") {
      const settings = await getPrayerRequestSettings();
      const targets = [
        ...(item.includeInSundayPrayers ? addresses(settings.sundayEmail) : []),
        ...(item.requestPastoralContact ? addresses(settings.eldersEmail) : [])
      ];
      await Promise.allSettled(targets.map((recipient) => sendMembershipEmail({ recipient, subject: "Approved prayer request", bodyText: `${item.submitterName}'s prayer request:\n\n${item.request}`, bodyHtml: `<p><strong>${item.submitterName}</strong>'s prayer request:</p><p>${item.request.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`, attachments: [] })));
    }
    return NextResponse.json({ request: item });
  } catch {
    return NextResponse.json({ error: "Unable to review prayer request." }, { status: 403 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission("MANAGE_MEMBERSHIP");
    const input = await request.json().catch(() => null);
    if (typeof input?.id !== "string") return NextResponse.json({ error: "Invalid prayer request." }, { status: 400 });
    await db.prayerRequest.delete({ where: { id: input.id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete prayer request." }, { status: 403 });
  }
}
