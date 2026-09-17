import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { deliverRun } from "@/lib/report-automations";
import crypto from "node:crypto";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    const automation = await db.reportAutomation.findFirst({ where: { id: params.id, createdById: user.id } });
    if (!automation) return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { test?: unknown };
    let recipientOverride: string | undefined;
    if (body.test === true) {
      const account = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
      if (!account?.email) return NextResponse.json({ error: "Your account does not have an email address for test delivery." }, { status: 400 });
      recipientOverride = account.email;
    }
    const run = await db.reportAutomationRun.create({ data: { automationId: automation.id, scheduledFor: new Date(), status: "RUNNING", startedAt: new Date(), claimedAt: new Date(), claimToken: crypto.randomUUID(), attemptCount: 1, idempotencyKey: `${automation.id}:manual:${crypto.randomUUID()}` } });
    await deliverRun(run.id, recipientOverride);
    await logAudit({ activityType: "report-automation-run", summary: `${recipientOverride ? "Test delivery" : "Report automation run"}: ${automation.name}`, actorId: user.id, details: run.id });
    return NextResponse.json({ run: await db.reportAutomationRun.findUnique({ where: { id: run.id } }) });
  } catch { return NextResponse.json({ error: "Unable to run report automation." }, { status: 400 }); }
}
