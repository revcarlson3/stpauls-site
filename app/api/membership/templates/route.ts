import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { htmlToText, sanitizeEmailHtml } from "@/lib/membership-messaging";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const scope = await requireTenantScope();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
    const bodyHtml = typeof input?.bodyHtml === "string" ? sanitizeEmailHtml(input.bodyHtml) : "";
    if (!name || name.length > 100 || !subject || subject.length > 200 || !bodyHtml || !htmlToText(bodyHtml)) return NextResponse.json({ error: "Template name, subject, and message are required." }, { status: 400 });
    const template = await db.membershipMessageTemplate.create({
      data: { churchId: scope.church.id, name, subject, bodyHtml, bodyText: htmlToText(bodyHtml), createdById: user.id },
      select: { id: true, name: true, subject: true, bodyHtml: true, bodyText: true, createdAt: true }
    });
    await logAudit({ activityType: "membership-message-template-created", summary: `Saved membership message template “${name}”.`, actorId: user.id });
    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to save the message template." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
    try {
      const user = await requirePermission("MANAGE_MEMBERSHIP");
      await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
      const input = await request.json();
      const id = typeof input?.id === "string" ? input.id : "";
      const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
      const bodyHtml = typeof input?.bodyHtml === "string" ? sanitizeEmailHtml(input.bodyHtml) : "";
      if (!id || !subject || subject.length > 200 || !bodyHtml || !htmlToText(bodyHtml)) return NextResponse.json({ error: "Template subject and message are required." }, { status: 400 });
      const existing = await db.membershipMessageTemplate.findUnique({ where: { id }, select: { createdById: true } });
      if (!existing || existing.createdById !== user.id) return NextResponse.json({ error: "Template not found." }, { status: 404 });
      const template = await db.membershipMessageTemplate.update({
        where: { id },
        data: { subject, bodyHtml, bodyText: htmlToText(bodyHtml) },
        select: { id: true, name: true, subject: true, bodyHtml: true, bodyText: true, createdAt: true }
      });
      await logAudit({ activityType: "membership-message-template-updated", summary: `Updated membership message template “${template.name}”.`, actorId: user.id });
      return NextResponse.json({ template });
    } catch {
      return NextResponse.json({ error: "Unable to update the message template." }, { status: 500 });
    }
  }

export async function DELETE(request: Request) {
    try {
      const user = await requirePermission("MANAGE_MEMBERSHIP");
      await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
      const id = new URL(request.url).searchParams.get("id") ?? "";
      if (!id) return NextResponse.json({ error: "Template ID is required." }, { status: 400 });
      const existing = await db.membershipMessageTemplate.findUnique({ where: { id }, select: { name: true, createdById: true } });
      if (!existing || existing.createdById !== user.id) return NextResponse.json({ error: "Template not found." }, { status: 404 });
      const template = await db.membershipMessageTemplate.delete({ where: { id }, select: { name: true } });
      await logAudit({ activityType: "membership-message-template-deleted", summary: `Deleted membership message template “${template.name}”.`, actorId: user.id });
      return NextResponse.json({ deleted: true });
    } catch {
      return NextResponse.json({ error: "Unable to delete the message template." }, { status: 500 });
    }
}
