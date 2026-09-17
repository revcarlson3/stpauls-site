import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { normalizeAutomation, nextScheduledAt } from "@/lib/report-automations";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    const existing = await db.reportAutomation.findFirst({ where: { id: params.id, createdById: user.id }, include: { report: true } });
    if (!existing) return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    const body = normalizeAutomation(await request.json());
    const scheduleChanged = existing.scheduleKind !== body.scheduleKind || JSON.stringify(existing.schedule) !== JSON.stringify(body.schedule) || existing.timezone !== body.timezone || !existing.enabled;
    const data = { ...body, schedule: body.schedule, criteria: body.criteria, recipients: body.recipients, inAppEnabled: body.inAppEnabled, nextRunAt: body.enabled ? (scheduleChanged ? nextScheduledAt(body.scheduleKind, body.schedule, body.timezone) : existing.nextRunAt ?? nextScheduledAt(body.scheduleKind, body.schedule, body.timezone)) : null };
    const automation = await db.reportAutomation.update({ where: { id: existing.id }, data });
    await logAudit({ activityType: "report-automation-updated", summary: `Report automation updated: ${automation.name}`, actorId: user.id, details: automation.id });
    return NextResponse.json({ automation });
  } catch { return NextResponse.json({ error: "Unable to update report automation." }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    await db.reportAutomation.delete({ where: { id: params.id, createdById: user.id } });
    await logAudit({ activityType: "report-automation-deleted", summary: "Report automation deleted", actorId: user.id, details: params.id });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete report automation." }, { status: 400 }); }
}
