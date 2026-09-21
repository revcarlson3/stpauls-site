import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { deliverRun } from "@/lib/report-automations";
import crypto from "node:crypto";

export async function POST(_: Request, { params }: { params: { id: string; runId: string } }) {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    const run = await db.reportAutomationRun.findFirst({ where: { id: params.runId, automationId: params.id, automation: { createdById: user.id }, status: "FAILED" } });
    if (!run) return NextResponse.json({ error: "Failed run not found." }, { status: 404 });
    const retry = await db.reportAutomationRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: new Date(), claimedAt: new Date(), claimToken: crypto.randomUUID(), attemptCount: { increment: 1 }, completedAt: null } });
    await deliverRun(retry.id);
    return NextResponse.json({ run: await db.reportAutomationRun.findUnique({ where: { id: retry.id } }) });
  } catch { return NextResponse.json({ error: "Unable to retry report automation run." }, { status: 400 }); }
}
