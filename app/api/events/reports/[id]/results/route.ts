import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EVENT_REPORT_COLUMNS, EVENT_TYPE_LABELS, eventReportSummary } from "@/lib/event-reporting";
import { formatReportDate } from "@/lib/report-date-format";
import { dynamicMemberIds } from "@/lib/membership-audiences";
import { authorizeReportExecution, authorizeReportModule } from "@/lib/reporting";
const date = (value: Date | null, timeZone?: string | null) => value ? formatReportDate(value, timeZone || "America/Chicago") : "";
function matches(row: Record<string, unknown>, criteria: unknown) {
  const conditions = criteria && typeof criteria === "object" && Array.isArray((criteria as Record<string, unknown>).conditions)
    ? (criteria as Record<string, unknown>).conditions as Record<string, unknown>[] : [];
  const matchMode = criteria && typeof criteria === "object" && (criteria as Record<string, unknown>).match === "any" ? "any" : "all";
  const results = conditions.map((condition) => {
    const field = String(condition.field || "");
    const actual = String(row[field] ?? "").toLowerCase();
    const expectedValue = field === "eventType" ? EVENT_TYPE_LABELS[String(condition.value ?? "")] || String(condition.value ?? "") : String(condition.value ?? "");
    const expected = expectedValue.toLowerCase();
    if (condition.operator === "not_equals") return actual !== expected;
    if (condition.operator === "contains") return actual.includes(expected);
    if (["greater_than", "less_than", "greater_or_equal", "less_or_equal"].includes(String(condition.operator))) {
      const actualNumber = Number(row[field]);
      const expectedNumber = Number(condition.value);
      const actualValue = Number.isNaN(actualNumber) ? Date.parse(String(row[field] ?? "")) : actualNumber;
      const expectedValue = Number.isNaN(expectedNumber) ? Date.parse(String(condition.value ?? "")) : expectedNumber;
      if (Number.isNaN(actualValue) || Number.isNaN(expectedValue)) return false;
      if (condition.operator === "greater_than") return actualValue > expectedValue;
      if (condition.operator === "less_than") return actualValue < expectedValue;
      if (condition.operator === "greater_or_equal") return actualValue >= expectedValue;
      return actualValue <= expectedValue;
    }
    return actual === expected;
  });
  return matchMode === "any" ? results.some(Boolean) : results.every(Boolean);
}
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const requestedChurchId = url.searchParams.get("churchId") || undefined;
    const preliminaryScope = await authorizeReportModule({ module: "events", churchId: requestedChurchId });
    const currentUser = preliminaryScope.user;
    let report = await db.membershipReport.findFirst({ where: { id: params.id, churchId: preliminaryScope.churchId, scope: "EVENT", OR: [{ createdById: currentUser.id }, { visibility: "EVENT_MANAGERS" }] } });
    if (params.id === "preview") {
      const definition = url.searchParams.get("definition");
      if (!definition) return NextResponse.json({ error: "Report definition is required." }, { status: 400 });
      const parsed = JSON.parse(definition) as Record<string, unknown>;
      report = { id: "preview", name: typeof parsed.name === "string" ? parsed.name : "One-time event report", reportType: String(parsed.reportType || "event-list"), criteria: parsed.criteria ?? {}, columns: parsed.columns ?? EVENT_REPORT_COLUMNS, sort: parsed.sort ?? [], grouping: parsed.grouping ?? {}, layout: {}, visibility: "PRIVATE", createdById: currentUser.id } as typeof report;
    }
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const { user } = await authorizeReportExecution({ module: "events", reportType: report.reportType, churchId: requestedChurchId });
    const type = report.reportType;
    const scheduleCriteria = report.criteria && typeof report.criteria === "object" ? report.criteria as { dateFrom?: unknown; dateTo?: unknown; eventLimit?: unknown; volunteerGroupIds?: unknown[] } : {};
    const selectedGroupIds = type === "volunteer-schedule" && Array.isArray(scheduleCriteria.volunteerGroupIds)
      ? scheduleCriteria.volunteerGroupIds.filter((value): value is string => typeof value === "string")
      : [];
    const selectedGroups = selectedGroupIds.length
      ? await db.membershipVolunteerGroup.findMany({ where: { id: { in: selectedGroupIds }, churchId: preliminaryScope.churchId }, select: { id: true, name: true } })
      : [];
    const events = await db.membershipEvent.findMany({
      where: { churchId: preliminaryScope.churchId },
      orderBy: { startsAt: "desc" },
      include: {
        attendance: { include: { individual: true } },
        rotationAssignments: { include: { individual: true, group: true } },
        volunteerGroups: { select: { groupId: true } }
      }
    });
    const rows: Record<string, unknown>[] = [];
    const dateFilteredEvents = events.filter((event) => {
          const eventDate = event.startsAt.toISOString().slice(0, 10);
          return (!scheduleCriteria.dateFrom || eventDate >= String(scheduleCriteria.dateFrom)) &&
            (!scheduleCriteria.dateTo || eventDate <= String(scheduleCriteria.dateTo));
        });
    const scheduleEvents = type === "volunteer-schedule"
      ? dateFilteredEvents.slice(0, Number.isInteger(Number(scheduleCriteria.eventLimit)) && Number(scheduleCriteria.eventLimit) > 0 ? Number(scheduleCriteria.eventLimit) : undefined)
      : dateFilteredEvents;
    for (const event of scheduleEvents) {
      const attendanceCount = event.attendance.filter((record) => record.status === "PRESENT").length;
      let rosterAbsentCount = event.attendance.filter((record) => record.status === "ABSENT").length;
      let missingRosterMembers: { id: string; memberNumber: string; memberName: string }[] = [];
      if (event.attendanceAudienceType !== null || event.volunteerGroups.length > 0) {
        const eventGroupIds = event.attendanceAudienceType === "VOLUNTEER" && event.attendanceAudienceId
          ? [event.attendanceAudienceId]
          : event.attendanceAudienceType ? [] : (await db.membershipEventVolunteerGroup.findMany({ where: { eventId: event.id }, select: { groupId: true } })).map((link) => link.groupId);
        const manualListId = event.attendanceAudienceType === "MANUAL" ? event.attendanceAudienceId : null;
        let rosterIds: string[] = [];
        if (event.attendanceAudienceType === "DYNAMIC" && event.attendanceAudienceId) {
          const list = await db.membershipDynamicList.findUnique({ where: { id: event.attendanceAudienceId }, select: { criteria: true } });
          rosterIds = list ? await dynamicMemberIds(list.criteria) : [];
        } else if (manualListId) {
          const list = await db.membershipManualList.findUnique({ where: { id: manualListId }, select: { members: { select: { individualId: true } } } });
          rosterIds = list?.members.map((member) => member.individualId) ?? [];
        } else if (eventGroupIds.length) {
          const members = await db.membershipIndividual.findMany({ where: { churchId: preliminaryScope.churchId, status: { not: "REMOVED" }, volunteerGroups: { some: { groupId: { in: eventGroupIds } } } }, select: { id: true } });
          rosterIds = members.map((member) => member.id);
        }
        const presentIds = new Set(event.attendance.map((record) => record.individualId));
        const missingIds = rosterIds.filter((id) => !presentIds.has(id));
        rosterAbsentCount += missingIds.length;
        if (type === "absentee" && missingIds.length) {
          const missingMembers = await db.membershipIndividual.findMany({ where: { id: { in: missingIds }, churchId: preliminaryScope.churchId }, select: { id: true, memberNumber: true, firstName: true, lastName: true } });
          missingRosterMembers = missingMembers.map((member) => ({ id: member.id, memberNumber: String(member.memberNumber), memberName: `${member.lastName || ""}, ${member.firstName}`.trim() }));
        }
      }
      const base = { id: event.id, _eventId: event.id, eventTitle: event.title, eventType: EVENT_TYPE_LABELS[event.eventType] || event.eventType, eventStatus: event.status, eventStartsAt: date(event.startsAt, event.timeZone), eventEndsAt: date(event.endsAt, event.timeZone), eventCategory: event.category || "", eventLocation: event.location || "", attendanceCount, visitorCount: event.visitorCount, totalAttendance: attendanceCount + event.visitorCount, _absenceCount: rosterAbsentCount, _volunteerAssignmentCount: event.rotationAssignments.length };
      if (type === "event-list" || type === "custom") rows.push(base);
      if (type === "attendance" || type === "absentee") {
        for (const record of event.attendance) {
          if (type === "absentee" && record.status !== "ABSENT") continue;
          rows.push({ ...base, id: record.id, memberNumber: record.individual.memberNumber, memberName: `${record.individual.lastName || ""}, ${record.individual.firstName}`.trim(), attendanceStatus: record.status });
        }
        if (type === "absentee" && (event.attendanceAudienceType !== null || event.volunteerGroups.length > 0)) {
          // Missing roster records are intentionally treated as ABSENT; attendance entry creates them on save.
          for (const member of missingRosterMembers) rows.push({ ...base, id: `${event.id}-missing-${member.id}`, memberNumber: member.memberNumber, memberName: member.memberName, attendanceStatus: "ABSENT" });
        }
      }
      if (type === "volunteers") {
        for (const assignment of event.rotationAssignments) rows.push({ ...base, id: assignment.id, volunteerGroup: assignment.group.name, volunteerName: `${assignment.individual.lastName || ""}, ${assignment.individual.firstName}`.trim(), assignmentSource: assignment.source });
      }
      if (type === "volunteer-schedule") {
        const scheduleRow: Record<string, unknown> = { ...base, id: event.id, eventDate: formatReportDate(event.startsAt.toISOString().slice(0, 10)) };
        for (const group of selectedGroups) {
          const names = event.rotationAssignments
            .filter((assignment) => assignment.groupId === group.id)
            .map((assignment) => `${assignment.individual.firstName} ${assignment.individual.lastName || ""}`.trim());
          scheduleRow[`group:${group.id}`] = names.join(", ");
        }
        rows.push(scheduleRow);
      }
    }
    const search = (url.searchParams.get("search") || url.searchParams.get("search[value]") || "").toLowerCase();
    const filtered = rows.filter((row) => matches(row, report.criteria) && (!search || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search))));
    const sort = Array.isArray(report.sort) && report.sort.length ? report.sort[0] as { key?: string; direction?: string } : { key: "eventStartsAt", direction: "desc" };
    filtered.sort((a, b) => String(a[sort.key || "eventStartsAt"] ?? "").localeCompare(String(b[sort.key || "eventStartsAt"] ?? "")) * (sort.direction === "asc" ? 1 : -1));
    const columns = Array.isArray(report.columns) && report.columns.length ? report.columns : EVENT_REPORT_COLUMNS;
    const normalizedRows = filtered.map((row) => {
      const normalized: Record<string, unknown> = { id: String(row.id || "") };
      for (const column of columns) {
        const key = column && typeof column === "object" && "key" in column ? String((column as { key: unknown }).key) : "";
        if (key) normalized[key] = row[key] ?? "";
      }
      return normalized;
    });
    const draw = Number(url.searchParams.get("draw") || 0);
    const start = Number(url.searchParams.get("start") || 0);
    const length = Number(url.searchParams.get("length") || 10000);
    const resultRows = normalizedRows.slice(start, start + length);
    const groupingKey = report.grouping && typeof report.grouping === "object" ? String((report.grouping as { key?: unknown }).key || "") : "";
    const groupingCounts = groupingKey ? Object.entries(filtered.reduce<Record<string, number>>((counts, row) => { const value = String(row[groupingKey] ?? "—"); counts[value] = (counts[value] || 0) + 1; return counts; }, {})).map(([label, count]) => ({ label, count })) : [];
    const summary = eventReportSummary(type as "event-list" | "attendance" | "absentee" | "volunteers" | "volunteer-schedule" | "custom", filtered);
    const reportMeta = { id: report.id, name: report.name, reportType: report.reportType, criteria: report.criteria, columns, grouping: groupingKey, groupingCounts, summary, layout: report.layout, generatedAt: new Date().toISOString(), generatedBy: user.name };
    if (draw) return NextResponse.json({ draw, recordsTotal: rows.length, recordsFiltered: filtered.length, data: resultRows, report: reportMeta });
    return NextResponse.json({ report: reportMeta, columns, rows: resultRows, total: filtered.length });
  } catch { return NextResponse.json({ error: "Unable to generate event report." }, { status: 400 }); }
}
