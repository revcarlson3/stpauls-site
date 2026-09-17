import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    const automation = await db.reportAutomation.findFirst({ where: { id: params.id, createdById: user.id } });
    if (!automation) return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    const runs = await db.reportAutomationRun.findMany({ where: { automationId: automation.id }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ runs: runs.map((run) => ({ ...run, durationMs: run.startedAt && run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : null, isRetry: run.attemptCount > 1 })) });
  } catch { return NextResponse.json({ error: "Unable to load run history." }, { status: 403 }); }
}
