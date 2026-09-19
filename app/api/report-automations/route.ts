import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { normalizeAutomation, canAutomateReportScope, nextScheduledAt } from "@/lib/report-automations";
import { logAudit } from "@/lib/audit";
import { requireTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const user = await requirePermission("ACCESS_ADMIN");
    const scope = await requireTenantScope();
    const automations = await db.reportAutomation.findMany({ where: { churchId: scope.church.id, createdById: user.id }, orderBy: { updatedAt: "desc" }, include: { report: { select: { id: true, name: true, scope: true, reportType: true } }, runs: { orderBy: { createdAt: "desc" }, take: 5 } } });
    return NextResponse.json({ automations });
  } catch { return NextResponse.json({ error: "Unable to load report automations." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const body = normalizeAutomation(await request.json());
    const user = await requirePermission("ACCESS_ADMIN");
    const scope = await requireTenantScope();
    const report = await db.membershipReport.findFirst({ where: { id: body.reportId, churchId: scope.church.id, OR: [{ createdById: user.id }, { visibility: { in: ["MEMBERSHIP_MANAGERS", "EVENT_MANAGERS"] } }] } });
    if (!report || !canAutomateReportScope(report.scope, user.permissions)) return NextResponse.json({ error: "Report not found or unavailable." }, { status: 404 });
    if (!body.name || !body.recipients.length || !body.subject) return NextResponse.json({ error: "Name, subject, and at least one valid recipient are required." }, { status: 400 });
    const automation = await db.reportAutomation.create({ data: { ...body, churchId: scope.church.id, schedule: body.schedule, criteria: body.criteria, recipients: body.recipients, inAppEnabled: body.inAppEnabled, nextRunAt: body.enabled ? nextScheduledAt(body.scheduleKind, body.schedule, body.timezone) : null, createdById: user.id } });
    await logAudit({ activityType: "report-automation-created", summary: `Report automation created: ${automation.name}`, actorId: user.id, details: automation.id });
    return NextResponse.json({ automation }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to create report automation." }, { status: 400 }); }
}
