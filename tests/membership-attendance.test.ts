import { describe, expect, it } from "vitest";
import {
  MembershipAttendanceInputError,
  membershipAttendanceReportRow,
  normalizeAttendanceEntries,
  normalizeMembershipEventInput
} from "@/lib/membership-attendance";

describe("membership event validation", () => {
  it("normalizes event fields and parses report-safe dates", () => {
    const event = normalizeMembershipEventInput({
      title: "  Sunday   Worship ",
      eventType: "WORSHIP",
      status: "SCHEDULED",
      category: " Weekly ",
      location: " Sanctuary ",
      startsAt: "2026-09-13T14:00:00.000Z",
      endsAt: "2026-09-13T15:00:00.000Z"
    });

    expect(event.title).toBe("Sunday Worship");
    expect(event.category).toBe("Weekly");
    expect(event.startsAt).toEqual(new Date("2026-09-13T14:00:00.000Z"));
  });

  it("rejects an end before the start", () => {
    expect(() => normalizeMembershipEventInput({
      title: "Class",
      startsAt: "2026-09-13T15:00:00.000Z",
      endsAt: "2026-09-13T14:00:00.000Z"
    })).toThrow(MembershipAttendanceInputError);
  });
});

describe("membership attendance validation", () => {
  it("normalizes a bounded batch and allows clearing a record", () => {
    expect(normalizeAttendanceEntries([
      { individualId: "member-1", status: "PRESENT", participationType: "VOLUNTEER", minutesParticipated: "90", notes: "  Usher team  " },
      { individualId: "member-2", status: "", participationType: "ATTENDEE", minutesParticipated: "" }
    ])).toEqual([
      { individualId: "member-1", status: "PRESENT", participationType: "VOLUNTEER", minutesParticipated: 90, notes: "Usher team" },
      { individualId: "member-2", status: null, participationType: "ATTENDEE", minutesParticipated: null, notes: null }
    ]);
  });

  it("rejects duplicate members and unreasonable participation duration", () => {
    expect(() => normalizeAttendanceEntries([
      { individualId: "member-1", status: "PRESENT", minutesParticipated: 10081 }
    ])).toThrow("Participation minutes");
    expect(() => normalizeAttendanceEntries([
      { individualId: "member-1", status: "PRESENT" },
      { individualId: "member-1", status: "ABSENT" }
    ])).toThrow("unique member");
  });

  it("maps attendance records to stable reporting fields", () => {
    const row = membershipAttendanceReportRow({
      status: "PRESENT",
      participationType: "LEADER",
      source: "MANUAL",
      checkedInAt: new Date("2026-09-13T13:55:00.000Z"),
      minutesParticipated: 75,
      recordedAt: new Date("2026-09-13T14:01:00.000Z"),
      event: { id: "event-1", title: "Sunday Worship", eventType: "WORSHIP", category: "Weekly", location: "Sanctuary", startsAt: new Date("2026-09-13T14:00:00.000Z"), endsAt: new Date("2026-09-13T15:00:00.000Z") },
      individual: { id: "member-1", memberNumber: 42, firstName: "Alex", lastName: null, family: { lastName: "Johnson" } }
    });

    expect(row).toMatchObject({
      eventId: "event-1",
      individualId: "member-1",
      memberName: "Alex Johnson",
      attendanceStatus: "PRESENT",
      participationType: "LEADER",
      minutesParticipated: 75
    });
  });
});
