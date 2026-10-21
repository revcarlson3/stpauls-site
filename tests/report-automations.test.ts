import { describe, expect, it } from "vitest";
import { closestUpcomingEvents, ensureVolunteerScheduleColumns, formatVolunteerAssignments } from "@/lib/event-reporting";
import { canAutomateReportScope, isAutomationDue, isRequestSchedulerLockAvailable, nextScheduledAt, nextSundayDateKey, normalizeAutomation, renderReportEmail, selectAutomationScheduleEvents, shouldAttemptRequestScheduler } from "@/lib/report-automations";

describe("report automation definitions", () => {
  it("normalizes recipients, limits, and schedule values", () => {
    const result = normalizeAutomation({ name: " Weekly ", reportId: "r1", recipients: [" A@EXAMPLE.COM ", "bad", "a@example.com"], scheduleKind: "DAILY", schedule: { hour: 25, minute: -2 } });
    expect(result.name).toBe("Weekly");
    expect(result.recipients).toEqual(["a@example.com"]);
    expect(result.schedule).toMatchObject({ hour: 23, minute: 0 });
  });

  it("preserves the coming-Sunday event selection mode", () => {
    expect(normalizeAutomation({ criteria: { eventSelection: "NEXT_SUNDAY" } }).criteria.eventSelection).toBe("NEXT_SUNDAY");
    expect(normalizeAutomation({ criteria: { eventSelection: "unsupported" } }).criteria.eventSelection).toBe("ALL");
  });

  it("calculates the coming Sunday in the automation timezone", () => {
    expect(nextSundayDateKey(new Date("2026-10-21T15:17:00.000Z"), "America/Chicago")).toBe("2026-10-25");
    expect(nextSundayDateKey(new Date("2026-10-25T15:17:00.000Z"), "America/Chicago")).toBe("2026-10-25");
  });

  it("includes every event on the coming Sunday even when the saved report has a one-event limit", () => {
    const events = [{ id: "divine-service" }, { id: "fellowship" }];
    expect(selectAutomationScheduleEvents(events, "NEXT_SUNDAY", 1).map((event) => event.id)).toEqual(["divine-service", "fellowship"]);
    expect(selectAutomationScheduleEvents(events, "MOST_RECENT", 1).map((event) => event.id)).toEqual(["divine-service"]);
  });

  it("limits volunteer reports to the closest future events", () => {
    const now = new Date("2026-10-21T15:00:00.000Z");
    const events = [
      { id: "later", startsAt: new Date("2026-11-01T15:00:00.000Z") },
      { id: "past", startsAt: new Date("2026-10-18T15:00:00.000Z") },
      { id: "coming", startsAt: new Date("2026-10-25T15:00:00.000Z") }
    ];
    expect(closestUpcomingEvents(events, 1, now).map((event) => event.id)).toEqual(["coming"]);
  });

  it("includes all assigned volunteer names in schedule rows", () => {
    expect(formatVolunteerAssignments([
      { group: { name: "Ushers" }, individual: { firstName: "Jane", lastName: "Doe" } },
      { group: { name: "Readers" }, individual: { firstName: "John", lastName: null } }
    ])).toBe("Ushers: Jane Doe; Readers: John");
    expect(ensureVolunteerScheduleColumns([{ key: "eventDate", label: "Event date" }])).toEqual([
      { key: "eventDate", label: "Event date" },
      { key: "volunteers", label: "Volunteers" }
    ]);
  });

  it("only considers scheduled automations eligible at their configured time", () => {
    const now = new Date("2026-09-14T08:00:00");
    expect(isAutomationDue({ enabled: true, scheduleKind: "DAILY", schedule: { hour: 8, minute: 0 } }, now)).toBe(true);
    expect(isAutomationDue({ enabled: true, scheduleKind: "DAILY", schedule: { hour: 9, minute: 0 } }, now)).toBe(false);
    expect(isAutomationDue({ enabled: false, scheduleKind: "DAILY", schedule: { hour: 8, minute: 0 } }, now)).toBe(false);
  });

  it("calculates the next run in the configured timezone", () => {
    const now = new Date("2026-09-14T13:00:00.000Z");
    const next = nextScheduledAt("DAILY", { hour: 8, minute: 0, dayOfWeek: 1 }, "America/Chicago", now);
    expect(next?.toISOString()).toBe("2026-09-15T13:00:00.000Z");
    expect(isAutomationDue({ enabled: true, scheduleKind: "DAILY", schedule: { hour: 8, minute: 0 }, timezone: "America/Chicago" }, now)).toBe(true);
  });

  it("keeps membership and event report permissions scoped", () => {
    expect(canAutomateReportScope("MEMBERSHIP", ["MANAGE_MEMBERSHIP"])).toBe(true);
    expect(canAutomateReportScope("EVENT", ["MANAGE_MEMBERSHIP"])).toBe(false);
    expect(canAutomateReportScope("EVENT", ["MANAGE_EVENTS"])).toBe(true);
  });

  it("renders useful escaped CSV and printable HTML attachments", () => {
    const csv = renderReportEmail({ title: "People", columns: [{ key: "name", label: "Name" }], rows: [{ name: 'A "quoted" person' }], format: "CSV" });
    expect(csv.csv).toContain('"A ""quoted"" person"');
    const html = renderReportEmail({ title: "People", columns: [{ key: "name", label: "Name" }], rows: [{ name: "<unsafe>" }], format: "HTML" });
    expect(html.attachments[0].contentType).toBe("text/html");
    expect(Buffer.from(html.attachments[0].contentBase64, "base64").toString()).toContain("&lt;unsafe&gt;");
  });

  it("throttles request scheduler attempts without sharing mutable state", () => {
    const state = { nextAttemptAt: 0 };
    expect(shouldAttemptRequestScheduler(1_000, state)).toBe(true);
    expect(shouldAttemptRequestScheduler(1_001, state)).toBe(false);
    expect(shouldAttemptRequestScheduler(61_001, state)).toBe(true);
  });

  it("does not acquire a live or recently checked database lock", () => {
    const now = new Date("2026-09-14T08:00:00Z");
    expect(isRequestSchedulerLockAvailable({ lockedUntil: new Date("2026-09-14T08:01:00Z"), lastCheckedAt: null }, now)).toBe(false);
    expect(isRequestSchedulerLockAvailable({ lockedUntil: null, lastCheckedAt: new Date("2026-09-14T07:59:30Z") }, now)).toBe(false);
    expect(isRequestSchedulerLockAvailable({ lockedUntil: new Date("2026-09-14T07:59:00Z"), lastCheckedAt: new Date("2026-09-14T07:58:00Z") }, now)).toBe(true);
  });
});
