import { describe, expect, it } from "vitest";
import { canAutomateReportScope, isAutomationDue, isRequestSchedulerLockAvailable, nextScheduledAt, normalizeAutomation, renderReportEmail, shouldAttemptRequestScheduler } from "@/lib/report-automations";

describe("report automation definitions", () => {
  it("normalizes recipients, limits, and schedule values", () => {
    const result = normalizeAutomation({ name: " Weekly ", reportId: "r1", recipients: [" A@EXAMPLE.COM ", "bad", "a@example.com"], scheduleKind: "DAILY", schedule: { hour: 25, minute: -2 } });
    expect(result.name).toBe("Weekly");
    expect(result.recipients).toEqual(["a@example.com"]);
    expect(result.schedule).toMatchObject({ hour: 23, minute: 0 });
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
