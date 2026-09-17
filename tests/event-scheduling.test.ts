import { describe, expect, it } from "vitest";
import { buildRecurringDates, selectRotationAssignments } from "@/lib/event-scheduling";
import { eventReportPreset, eventReportSummary } from "@/lib/event-reporting";
import { normalizeAttendanceEntries } from "@/lib/membership-attendance";

describe("event scheduling reliability", () => {
  it("keeps recurring-series dates stable while applying a changed occurrence count", () => {
    const dates = buildRecurringDates(new Date("2026-09-06T15:00:00.000Z"), {
      frequency: "WEEKLY", interval: 1, endMode: "OCCURRENCES", occurrences: 4
    });
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-09-06T15:00:00.000Z", "2026-09-13T15:00:00.000Z",
      "2026-09-20T15:00:00.000Z", "2026-09-27T15:00:00.000Z"
    ]);
  });

  it("advances volunteer rotations and wraps at the end", () => {
    expect(selectRotationAssignments(["a", "b", "c"], 2, 2)).toEqual({ selectedIds: ["c", "a"], nextPosition: 1 });
    expect(selectRotationAssignments(["a", "b", "c"], 1, 1)).toEqual({ selectedIds: ["b"], nextPosition: 2 });
  });

  it("preserves attendance rows for saving and uses stable report presets", () => {
    expect(normalizeAttendanceEntries([{ individualId: "member-1", status: "PRESENT", minutesParticipated: 60, notes: "  On time " }])).toEqual([
      { individualId: "member-1", status: "PRESENT", minutesParticipated: 60, notes: "On time" }
    ]);
    expect(eventReportPreset("volunteers")).toMatchObject({ sortKey: "eventStartsAt", groupingKey: "volunteerGroup" });
    expect(eventReportSummary("event-list", [
      { id: "event-1", attendanceCount: 3, _absenceCount: 1, visitorCount: 2, _volunteerAssignmentCount: 2 },
      { id: "event-2", attendanceCount: 1, _absenceCount: 0, visitorCount: 1, _volunteerAssignmentCount: 1 }
    ])).toEqual({ attendance: 4, absences: 1, visitors: 3, volunteerAssignments: 3 });
  });
});
