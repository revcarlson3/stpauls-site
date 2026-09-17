import { db } from "@/lib/db";
import { sendMembershipEmail, type EmailAttachment } from "@/lib/membership-delivery";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { EVENT_TYPE_LABELS } from "@/lib/event-reporting";
import { dynamicMemberIds } from "@/lib/membership-audiences";
import { formatReportDate } from "@/lib/report-date-format";
import { buildMembershipReportRows } from "@/lib/scheduled-reporting";

const REQUEST_SCHEDULER_LOCK_KEY = "report-automation-request";
const REQUEST_SCHEDULER_THROTTLE_MS = 60 * 1000;
const REQUEST_SCHEDULER_LEASE_MS = 5 * 60 * 1000;
let nextRequestSchedulerAttemptAt = 0;

export type AutomationDefinition = {
  name: string;
  reportId: string;
  enabled: boolean;
  scheduleKind: "MANUAL" | "HOURLY" | "DAILY" | "WEEKLY";
  schedule: { hour?: number; minute?: number; dayOfWeek?: number };
  recipients: string[];
  criteria: { eventSelection?: "ALL" | "MOST_RECENT" };
  subject: string;
  format: "CSV" | "HTML" | "PDF";
  inAppEnabled: boolean;
  timezone: string;
};

export function canAutomateReportScope(scope: string, permissions: string[]) {
  return scope === "EVENT" ? permissions.includes("MANAGE_EVENTS") : scope === "MEMBERSHIP" && permissions.includes("MANAGE_MEMBERSHIP");
}

export function normalizeAutomation(input: unknown): AutomationDefinition {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const schedule = value.schedule && typeof value.schedule === "object" ? value.schedule as Record<string, unknown> : {};
  const kind = ["MANUAL", "HOURLY", "DAILY", "WEEKLY"].includes(String(value.scheduleKind)) ? String(value.scheduleKind) as AutomationDefinition["scheduleKind"] : "MANUAL";
  const recipients = Array.isArray(value.recipients) ? Array.from(new Set(value.recipients.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item)))).slice(0, 100) : [];
  return {
    name: typeof value.name === "string" ? value.name.trim().slice(0, 120) : "",
    reportId: typeof value.reportId === "string" ? value.reportId : "",
    enabled: value.enabled === true,
    scheduleKind: kind,
    schedule: {
      hour: clampNumber(schedule.hour, 0, 23, 8),
      minute: clampNumber(schedule.minute, 0, 59, 0),
      dayOfWeek: clampNumber(schedule.dayOfWeek, 0, 6, 1)
    },
    recipients,
    criteria: {
      eventSelection: scheduleCriteriaSelection(value.criteria)
    },
    subject: typeof value.subject === "string" ? value.subject.trim().slice(0, 200) : "",
    format: value.format === "HTML" || value.format === "PDF" ? value.format : "CSV",
    inAppEnabled: value.inAppEnabled === true,
    timezone: typeof value.timezone === "string" && /^[A-Za-z_]+\/[A-Za-z_]+$/.test(value.timezone) ? value.timezone : "America/Chicago"
  };
}

function scheduleCriteriaSelection(value: unknown): "ALL" | "MOST_RECENT" {
  if (!value || typeof value !== "object") return "ALL";
  const selection = (value as Record<string, unknown>).eventSelection;
  return selection === "MOST_RECENT" ? "MOST_RECENT" : "ALL";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
}

type ScheduleInput = Pick<AutomationDefinition, "enabled" | "scheduleKind" | "schedule" | "timezone">;

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function zonedDate(parts: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string) {
  let candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  for (let index = 0; index < 3; index += 1) {
    const actual = zonedParts(candidate, timeZone);
    const expectedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    candidate = new Date(candidate.getTime() + expectedUtc - actualUtc);
  }
  return candidate;
}

export function nextScheduledAt(kind: AutomationDefinition["scheduleKind"], schedule: AutomationDefinition["schedule"], timeZone: string, from = new Date()) {
  if (kind === "MANUAL") return null;
  const local = zonedParts(from, timeZone);
  const target = { year: local.year, month: local.month, day: local.day, hour: kind === "HOURLY" ? local.hour : schedule.hour ?? 0, minute: schedule.minute ?? 0 };
  let candidate = zonedDate(target, timeZone);
  if (kind === "HOURLY") {
    if (candidate <= from) target.hour += 1;
  } else if (kind === "DAILY") {
    if (candidate <= from) target.day += 1;
  } else if (kind === "WEEKLY") {
    const currentDay = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
    let daysAhead = ((schedule.dayOfWeek ?? 1) - currentDay + 7) % 7;
    if (daysAhead === 0 && candidate <= from) daysAhead = 7;
    target.day += daysAhead;
  }
  candidate = zonedDate(target, timeZone);
  return candidate > from ? candidate : new Date(from.getTime() + 60_000);
}

export function isAutomationDue(automation: Pick<ScheduleInput, "enabled" | "scheduleKind" | "schedule"> & { timezone?: string }, now = new Date()) {
  if (!automation.enabled || automation.scheduleKind === "MANUAL") return false;
  const local = zonedParts(now, automation.timezone ?? "America/Chicago");
  if (automation.scheduleKind === "HOURLY") return local.minute === automation.schedule.minute;
  if (automation.scheduleKind === "DAILY") return local.hour === automation.schedule.hour && local.minute === automation.schedule.minute;
  return new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() === automation.schedule.dayOfWeek && local.hour === automation.schedule.hour && local.minute === automation.schedule.minute;
}

export function renderReportEmail(input: { title: string; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, unknown>>; format: "CSV" | "HTML" }) {
  const escape = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const csv = [input.columns.map((column) => csvEscape(column.label)).join(","), ...input.rows.map((row) => input.columns.map((column) => csvEscape(row[column.key])).join(","))].join("\r\n");
  const bodyText = `${input.title}\n\n${input.rows.length} row(s) are included in the attached report.`;
  const bodyHtml = `<h2>${escape(input.title)}</h2><p>${input.rows.length} row(s) are included in the attached report.</p>`;
  const attachment: EmailAttachment = input.format === "CSV"
    ? { fileName: `${safeFileName(input.title)}.csv`, contentBase64: Buffer.from(csv, "utf8").toString("base64"), contentType: "text/csv" }
    : { fileName: `${safeFileName(input.title)}.html`, contentBase64: Buffer.from(`<html><body><h1>${escape(input.title)}</h1><table border="1"><thead><tr>${input.columns.map((column) => `<th>${escape(column.label)}</th>`).join("")}</tr></thead><tbody>${input.rows.map((row) => `<tr>${input.columns.map((column) => `<td>${escape(row[column.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`, "utf8").toString("base64"), contentType: "text/html" };
  return { bodyText, bodyHtml, attachments: [attachment], csv };
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}
function safeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

function matchesSavedCriteria(row: Record<string, unknown>, criteria: unknown) {
  const value = criteria && typeof criteria === "object" ? criteria as Record<string, unknown> : {};
  const conditions = Array.isArray(value.conditions) ? value.conditions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const results = conditions.map((condition) => {
    const actual = String(row[String(condition.field || "")] ?? "").toLowerCase();
    const expected = String(condition.value ?? "").toLowerCase();
    switch (String(condition.operator || "equals")) {
      case "contains": return actual.includes(expected);
      case "not_equals":
      case "notEquals": return actual !== expected;
      case "greater_than": return Number(row[String(condition.field || "")]) > Number(condition.value);
      case "less_than": return Number(row[String(condition.field || "")]) < Number(condition.value);
      case "greater_or_equal":
      case "greaterOrEqual": return Number(row[String(condition.field || "")]) >= Number(condition.value);
      case "less_or_equal":
      case "lessOrEqual": return Number(row[String(condition.field || "")]) <= Number(condition.value);
      default: return actual === expected;
    }
  });
  return value.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

async function buildEventReportRows(report: { reportType: string; criteria: unknown; sort?: unknown }) {
  const criteria = report.criteria && typeof report.criteria === "object" ? report.criteria as Record<string, unknown> : {};
  const dateFrom = typeof criteria.dateFrom === "string" ? criteria.dateFrom : "";
  const dateTo = typeof criteria.dateTo === "string" ? criteria.dateTo : "";
  const eventLimit = Number(criteria.eventLimit);
  const selectedGroupIds = report.reportType === "volunteer-schedule" && Array.isArray(criteria.volunteerGroupIds) ? criteria.volunteerGroupIds.filter((value): value is string => typeof value === "string") : [];
  const selectedGroups = selectedGroupIds.length ? await db.membershipVolunteerGroup.findMany({ where: { id: { in: selectedGroupIds } }, select: { id: true } }) : [];
  const events = await db.membershipEvent.findMany({ orderBy: { startsAt: "desc" }, take: 10000, include: { attendance: { include: { individual: true } }, rotationAssignments: { include: { individual: true, group: true } }, volunteerGroups: { select: { groupId: true } } } });
  const filteredEvents = events.filter((event) => {
    const date = event.startsAt.toISOString().slice(0, 10);
    return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  });
  const scheduleEvents = criteria.eventSelection === "MOST_RECENT"
    ? filteredEvents.slice(0, 1)
    : report.reportType === "volunteer-schedule" && Number.isInteger(eventLimit) && eventLimit > 0 ? filteredEvents.slice(0, eventLimit) : filteredEvents;
  const rows: Array<Record<string, unknown>> = [];
  for (const event of scheduleEvents) {
    const presentIds = new Set(event.attendance.map((record) => record.individualId));
    let missingMembers: Array<{ id: string; memberNumber: string; memberName: string }> = [];
    let absenceCount = event.attendance.filter((record) => record.status === "ABSENT").length;
    if (event.attendanceAudienceType !== null || event.volunteerGroups.length > 0) {
      const groupIds = event.attendanceAudienceType === "VOLUNTEER" && event.attendanceAudienceId ? [event.attendanceAudienceId] : event.attendanceAudienceType ? [] : event.volunteerGroups.map((link) => link.groupId);
      let rosterIds: string[] = [];
      if (event.attendanceAudienceType === "DYNAMIC" && event.attendanceAudienceId) {
        const list = await db.membershipDynamicList.findUnique({ where: { id: event.attendanceAudienceId }, select: { criteria: true } });
        rosterIds = list ? await dynamicMemberIds(list.criteria) : [];
      } else if (event.attendanceAudienceType === "MANUAL" && event.attendanceAudienceId) {
        const list = await db.membershipManualList.findUnique({ where: { id: event.attendanceAudienceId }, select: { members: { select: { individualId: true } } } });
        rosterIds = list?.members.map((member) => member.individualId) ?? [];
      } else if (groupIds.length) {
        const members = await db.membershipIndividual.findMany({ where: { status: { not: "REMOVED" }, volunteerGroups: { some: { groupId: { in: groupIds } } } }, select: { id: true } });
        rosterIds = members.map((member) => member.id);
      }
      const missingIds = rosterIds.filter((id) => !presentIds.has(id));
      absenceCount += missingIds.length;
      if (report.reportType === "absentee" && missingIds.length) {
        const members = await db.membershipIndividual.findMany({ where: { id: { in: missingIds } }, select: { id: true, memberNumber: true, firstName: true, lastName: true } });
        missingMembers = members.map((member) => ({ id: member.id, memberNumber: String(member.memberNumber), memberName: `${member.lastName || ""}, ${member.firstName}`.trim() }));
      }
    }
    const timeZone = event.timeZone ?? undefined;
    const base = { id: event.id, _eventId: event.id, eventTitle: event.title, eventType: EVENT_TYPE_LABELS[event.eventType] || event.eventType, eventStatus: event.status, eventStartsAt: formatReportDate(event.startsAt, timeZone), eventEndsAt: formatReportDate(event.endsAt, timeZone), eventCategory: event.category || "", eventLocation: event.location || "", attendanceCount: event.attendance.filter((record) => record.status === "PRESENT").length, visitorCount: event.visitorCount, totalAttendance: event.attendance.filter((record) => record.status === "PRESENT").length + event.visitorCount, _absenceCount: absenceCount, _volunteerAssignmentCount: event.rotationAssignments.length };
    if (report.reportType === "event-list" || report.reportType === "custom") rows.push(base);
    if (report.reportType === "attendance" || report.reportType === "absentee") {
      for (const record of event.attendance) if (report.reportType !== "absentee" || record.status === "ABSENT") rows.push({ ...base, id: record.id, memberNumber: record.individual.memberNumber, memberName: `${record.individual.lastName || ""}, ${record.individual.firstName}`.trim(), attendanceStatus: record.status });
      for (const member of missingMembers) rows.push({ ...base, id: `${event.id}-missing-${member.id}`, memberNumber: member.memberNumber, memberName: member.memberName, attendanceStatus: "ABSENT" });
    }
    if (report.reportType === "volunteers") for (const assignment of event.rotationAssignments) rows.push({ ...base, id: assignment.id, volunteerGroup: assignment.group.name, volunteerName: `${assignment.individual.lastName || ""}, ${assignment.individual.firstName}`.trim(), assignmentSource: assignment.source });
    if (report.reportType === "volunteer-schedule") {
      const scheduleRow: Record<string, unknown> = { ...base, eventDate: formatReportDate(event.startsAt, timeZone) };
      for (const group of selectedGroups) scheduleRow[`group:${group.id}`] = event.rotationAssignments.filter((assignment) => assignment.groupId === group.id).map((assignment) => `${assignment.individual.firstName} ${assignment.individual.lastName || ""}`.trim()).join(", ");
      rows.push(scheduleRow);
    }
  }
  const filtered = rows.filter((row) => matchesSavedCriteria(row, criteria));
  const sort = Array.isArray(report.sort) && report.sort.length ? report.sort[0] as { key?: string; direction?: string } : { key: "eventStartsAt", direction: "desc" };
  filtered.sort((left, right) => String(left[sort.key || "eventStartsAt"] ?? "").localeCompare(String(right[sort.key || "eventStartsAt"] ?? "")) * (sort.direction === "asc" ? 1 : -1));
  return filtered;
}

async function renderPdfAttachment(title: string, columns: Array<{ key: string; label: string }>, rows: Array<Record<string, unknown>>) {
  const document = new PDFDocument({ margin: 30, size: columns.length > 5 ? "LETTER" : "LETTER", layout: columns.length > 5 ? "landscape" : "portrait" });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const pageBottom = document.page.height - document.page.margins.bottom;
  const cellPadding = 4;
  const headerHeight = 26;
  const fontSize = columns.length > 8 ? 6 : columns.length > 5 ? 7 : 8;
  const columnWidth = pageWidth / Math.max(columns.length, 1);

  const drawHeader = () => {
    const top = document.y;
    document.font("Helvetica-Bold").fontSize(fontSize);
    columns.forEach((column, index) => {
      const x = document.page.margins.left + index * columnWidth;
      document.rect(x, top, columnWidth, headerHeight).fillAndStroke("#eee8df", "#8b8176");
      document.fillColor("#201b18").text(column.label, x + cellPadding, top + cellPadding, {
        width: columnWidth - cellPadding * 2,
        height: headerHeight - cellPadding * 2,
        ellipsis: true
      });
    });
    document.fillColor("#201b18").y = top + headerHeight;
  };

  document.font("Helvetica-Bold").fontSize(16).fillColor("#201b18").text(title);
  document.font("Helvetica").fontSize(8).fillColor("#5b514a").text(`${rows.length} row(s)`);
  document.moveDown(0.75);
  drawHeader();

  for (const row of rows) {
    document.font("Helvetica").fontSize(fontSize);
    const heights = columns.map((column) => document.heightOfString(String(row[column.key] ?? ""), {
      width: Math.max(columnWidth - cellPadding * 2, 10),
      ellipsis: true
    }));
    const rowHeight = Math.max(22, Math.min(72, Math.max(...heights) + cellPadding * 2));
    if (document.y + rowHeight > pageBottom) {
      document.addPage();
      document.y = document.page.margins.top;
      drawHeader();
    }
    const top = document.y;
    columns.forEach((column, index) => {
      const x = document.page.margins.left + index * columnWidth;
      document.rect(x, top, columnWidth, rowHeight).stroke("#b8aea4");
      document.fillColor("#201b18").text(String(row[column.key] ?? ""), x + cellPadding, top + cellPadding, {
        width: columnWidth - cellPadding * 2,
        height: rowHeight - cellPadding * 2,
        ellipsis: true
      });
    });
    document.y = top + rowHeight;
  }
  document.end();
  const content = await finished;
  return { fileName: `${safeFileName(title)}.pdf`, contentBase64: content.toString("base64"), contentType: "application/pdf" };
}

export async function claimDueRuns(now = new Date(), limit = 10) {
  const automations = await db.reportAutomation.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, take: limit, orderBy: { nextRunAt: "asc" } });
  const claimed: Array<{ runId: string; automationId: string }> = [];
  for (const automation of automations) {
    const scheduledFor = automation.nextRunAt ?? now;
    const key = `${automation.id}:${scheduledFor.toISOString()}`;
    const token = crypto.randomUUID();
    const existing = await db.reportAutomationRun.findUnique({ where: { idempotencyKey: key } });
    const run = existing
      ? await db.reportAutomationRun.updateMany({ where: { id: existing.id, OR: [{ status: "PENDING" }, { status: "RUNNING", claimedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } }] }, data: { status: "RUNNING", startedAt: now, claimedAt: now, claimToken: token, attemptCount: { increment: 1 } } })
      : await db.reportAutomationRun.create({ data: { automationId: automation.id, scheduledFor, idempotencyKey: key, status: "RUNNING", startedAt: now, claimedAt: now, claimToken: token, attemptCount: 1 } }).then(() => ({ count: 1 }));
    if (run.count === 1) claimed.push({ runId: existing?.id ?? (await db.reportAutomationRun.findUniqueOrThrow({ where: { idempotencyKey: key } })).id, automationId: automation.id });
    await db.reportAutomation.update({ where: { id: automation.id }, data: { nextRunAt: nextScheduledAt(automation.scheduleKind as AutomationDefinition["scheduleKind"], automation.schedule as AutomationDefinition["schedule"], automation.timezone, scheduledFor), lastRunAt: scheduledFor } });
  }

  return claimed;
}

type RequestSchedulerState = { nextAttemptAt: number };

export function isRequestSchedulerLockAvailable(lock: { lockedUntil: Date | null; lastCheckedAt: Date | null }, now = new Date()) {
  return (!lock.lockedUntil || lock.lockedUntil < now) &&
    (!lock.lastCheckedAt || lock.lastCheckedAt < new Date(now.getTime() - REQUEST_SCHEDULER_THROTTLE_MS));
}

export function shouldAttemptRequestScheduler(now = Date.now(), state?: RequestSchedulerState) {
  const schedulerState = state ?? { nextAttemptAt: nextRequestSchedulerAttemptAt };
  if (now < schedulerState.nextAttemptAt) return false;
  schedulerState.nextAttemptAt = now + REQUEST_SCHEDULER_THROTTLE_MS;
  if (!state) nextRequestSchedulerAttemptAt = schedulerState.nextAttemptAt;
  return true;
}

async function acquireRequestSchedulerLock(now: Date) {
  const lockToken = crypto.randomUUID();
  const lockUntil = new Date(now.getTime() + REQUEST_SCHEDULER_LEASE_MS);
  try {
    await db.reportAutomationSchedulerLock.create({ data: { lockKey: REQUEST_SCHEDULER_LOCK_KEY, lockToken, lockedUntil: lockUntil, lastCheckedAt: now } });
    return lockToken;
  } catch {
    const acquired = await db.reportAutomationSchedulerLock.updateMany({
      where: {
        lockKey: REQUEST_SCHEDULER_LOCK_KEY,
        AND: [
          { OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
          { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - REQUEST_SCHEDULER_THROTTLE_MS) } }] }
        ]
      },
      data: { lockToken, lockedUntil: lockUntil, lastCheckedAt: now }
    });
    return acquired.count === 1 ? lockToken : null;
  }
}

async function releaseRequestSchedulerLock(lockToken: string) {
  await db.reportAutomationSchedulerLock.updateMany({
    where: { lockKey: REQUEST_SCHEDULER_LOCK_KEY, lockToken },
    data: { lockToken: null, lockedUntil: null }
  });
}

/**
 * Best-effort request trigger. It intentionally does not throw: page/API work
 * must never depend on scheduler availability.
 */
export async function triggerReportAutomationScheduler() {
  if (!shouldAttemptRequestScheduler()) return false;
  const now = new Date();
  let lockToken: string | null = null;
  try {
    lockToken = await acquireRequestSchedulerLock(now);
    if (!lockToken) return false;
    const claimed = await claimDueRuns(now);
    for (const run of claimed) await deliverRun(run.runId);
    return claimed.length > 0;
  } catch {
    return false;
  } finally {
    if (lockToken) {
      try { await releaseRequestSchedulerLock(lockToken); } catch { /* best effort */ }
    }
  }
}

export async function deliverRun(runId: string, recipientOverride?: string) {
  const run = await db.reportAutomationRun.findUnique({ where: { id: runId }, include: { automation: { include: { report: true } } } });
  if (!run || run.status !== "RUNNING") return;
  try {
    const report = run.automation.report;
    const columns = Array.isArray(report.columns) ? report.columns as Array<{ key: string; label: string }> : [];
    const savedCriteria = report.criteria && typeof report.criteria === "object" ? report.criteria as Record<string, unknown> : {};
    const filteredRows: Array<Record<string, unknown>> = report.scope === "EVENT"
      ? await buildEventReportRows({ reportType: report.reportType, criteria: { ...savedCriteria, ...((run.automation.criteria && typeof run.automation.criteria === "object") ? run.automation.criteria : {}) }, sort: report.sort })
      : await buildMembershipReportRows({ ...report, criteria: { ...savedCriteria, ...((run.automation.criteria && typeof run.automation.criteria === "object") ? run.automation.criteria : {}) } });
    const rendered = run.automation.format === "PDF"
      ? { bodyText: `${report.name}\n\n${filteredRows.length} row(s) are included in the attached report.`, bodyHtml: `<h2>${report.name}</h2><p>${filteredRows.length} row(s) are included in the attached report.</p>`, attachments: [await renderPdfAttachment(report.name, columns, filteredRows)] }
      : renderReportEmail({ title: report.name, columns, rows: filteredRows, format: run.automation.format === "HTML" ? "HTML" : "CSV" });
    const recipients = recipientOverride ? [recipientOverride] : Array.isArray(run.automation.recipients) ? run.automation.recipients.filter((item): item is string => typeof item === "string") : [];
    for (const recipient of recipients) await sendMembershipEmail({ recipient, subject: run.automation.subject || report.name, bodyHtml: rendered.bodyHtml, bodyText: rendered.bodyText, attachments: rendered.attachments });
    await db.reportAutomationRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", completedAt: new Date(), rowCount: filteredRows.length, attachment: rendered.attachments[0] ?? null, error: null } });
    await db.reportAutomation.update({ where: { id: run.automationId }, data: { failureCount: 0 } });
    if (run.automation.inAppEnabled && !recipientOverride) {
      const users = await db.user.findMany({ where: { isActive: true, email: { in: recipients } }, select: { id: true } });
      await db.reportAutomationNotification.createMany({
        data: users.map((user) => ({
          runId: run.id,
          userId: user.id,
          title: report.name,
          message: `${filteredRows.length} row(s) are ready to view or download.`,
          link: `/api/report-automations/runs/${run.id}/download`
        }))
      });
    }
  } catch (error) {
    const retry = run.attemptCount < 3;
    await db.reportAutomationRun.update({ where: { id: run.id }, data: { status: retry ? "PENDING" : "FAILED", error: error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed.", completedAt: new Date() } });
    await db.reportAutomation.update({ where: { id: run.automationId }, data: { failureCount: { increment: 1 } } });
    if (retry) await db.reportAutomation.update({ where: { id: run.automationId }, data: { nextRunAt: new Date(Date.now() + run.attemptCount * 5 * 60 * 1000) } });
  }
}
