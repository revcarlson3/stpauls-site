import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 30);
    const [upcoming, attendance, volunteerEvents, assignments, reports, automations] = await Promise.all([
      db.membershipEvent.findMany({ where: { churchId: scope.church.id, startsAt: { gte: now, lt: windowEnd }, status: { not: "CANCELLED" } }, orderBy: { startsAt: "asc" }, take: 6, select: { id: true, title: true, startsAt: true, endsAt: true, location: true, allDay: true, attendanceEnabled: true, volunteerGroups: { select: { group: { select: { name: true } } } } } }),
      db.membershipAttendanceRecord.groupBy({ by: ["status"], where: { event: { churchId: scope.church.id, startsAt: { gte: new Date(now.getTime() - 30 * 86400000), lt: now } } }, _count: { _all: true } }),
      db.membershipEvent.findMany({ where: { churchId: scope.church.id, startsAt: { gte: now, lt: windowEnd }, status: { not: "CANCELLED" }, volunteerGroups: { some: {} } }, select: { id: true, title: true, startsAt: true, volunteerGroups: { select: { group: { select: { name: true } } } } }, orderBy: { startsAt: "asc" }, take: 6 }),
      db.membershipEventVolunteerAssignment.count({ where: { event: { churchId: scope.church.id, startsAt: { gte: now, lt: windowEnd }, status: { not: "CANCELLED" } } } }),
      db.membershipReport.count({ where: { churchId: scope.church.id, scope: "EVENT" } }),
      db.reportAutomation.findMany({ where: { churchId: scope.church.id, report: { scope: "EVENT" }, enabled: true }, orderBy: { nextRunAt: "asc" }, take: 6, select: { id: true, name: true, nextRunAt: true, lastRunAt: true, failureCount: true } })
    ]);
    const attendanceCounts = attendance.map((item) => ({ label: item.status, count: item._count._all }));
    const attendanceTotal = attendanceCounts.reduce((sum, item) => sum + item.count, 0);
    return NextResponse.json({
      generatedAt: now.toISOString(),
      upcoming: upcoming.map((event) => ({ ...event, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null, volunteerGroups: event.volunteerGroups.map((item) => item.group.name) })),
      attendance: { windowDays: 30, total: attendanceTotal, counts: attendanceCounts },
      volunteer: { eventCount: volunteerEvents.length, assignmentCount: assignments, events: volunteerEvents.map((event) => ({ ...event, startsAt: event.startsAt.toISOString(), volunteerGroups: event.volunteerGroups.map((item) => item.group.name) })) },
      reporting: { reportCount: reports, automations: automations.map((automation) => ({ ...automation, nextRunAt: automation.nextRunAt?.toISOString() ?? null, lastRunAt: automation.lastRunAt?.toISOString() ?? null })) }
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load Events and Scheduling dashboard.");
  }
}
