import { describe, expect, it } from "vitest";
import {
  MembershipVolunteerInputError,
  membershipServiceReportRow,
  normalizeServiceAssignments,
  normalizeServiceOpportunityInput,
  normalizeServiceShiftInput
} from "@/lib/membership-volunteers";

describe("volunteer opportunity and shift validation", () => {
  it("normalizes an opportunity that is attached to an existing group", () => {
    expect(normalizeServiceOpportunityInput({
      groupId: " group-1 ",
      title: "  Sunday   Ushers ",
      defaultRole: " Usher ",
      location: " Narthex "
    })).toEqual({
      groupId: "group-1",
      title: "Sunday Ushers",
      defaultRole: "Usher",
      location: "Narthex"
    });
  });

  it("rejects invalid shift ranges and capacity", () => {
    expect(() => normalizeServiceShiftInput({
      opportunityId: "opportunity-1",
      startsAt: "2026-09-13T15:00:00.000Z",
      endsAt: "2026-09-13T14:00:00.000Z"
    })).toThrow(MembershipVolunteerInputError);
    expect(() => normalizeServiceShiftInput({
      opportunityId: "opportunity-1",
      startsAt: "2026-09-13T15:00:00.000Z",
      capacity: 0
    })).toThrow("Capacity");
  });

  it("does not clear omitted fields in partial shift updates", () => {
    expect(normalizeServiceShiftInput({ status: "COMPLETED" }, true)).toEqual({ status: "COMPLETED" });
  });
});

describe("volunteer assignment and service validation", () => {
  it("normalizes assignment and completed service details", () => {
    expect(normalizeServiceAssignments([{
      individualId: "member-1",
      assigned: true,
      status: "CONFIRMED",
      role: "  Team   lead ",
      outcome: "COMPLETED",
      minutesServed: "90",
      notes: "  Arrived early "
    }])).toEqual([{
      individualId: "member-1",
      assigned: true,
      status: "CONFIRMED",
      role: "Team lead",
      outcome: "COMPLETED",
      minutesServed: 90,
      notes: "Arrived early"
    }]);
  });

  it("uses zero minutes for a no-show and rejects outcomes without assignments", () => {
    expect(normalizeServiceAssignments([{
      individualId: "member-1",
      assigned: true,
      outcome: "NO_SHOW",
      minutesServed: ""
    }])[0].minutesServed).toBe(0);
    expect(() => normalizeServiceAssignments([{
      individualId: "member-1",
      assigned: false,
      outcome: "COMPLETED"
    }])).toThrow("requires an assigned volunteer");
  });

  it("maps service records to stable reporting fields", () => {
    const row = membershipServiceReportRow({
      outcome: "COMPLETED",
      minutesServed: 75,
      notes: "Ushered",
      recordedAt: new Date("2026-09-13T16:00:00.000Z"),
      assignment: {
        role: "Usher",
        status: "CONFIRMED",
        shift: {
          id: "shift-1",
          startsAt: new Date("2026-09-13T14:00:00.000Z"),
          endsAt: new Date("2026-09-13T15:00:00.000Z"),
          opportunity: { id: "opportunity-1", title: "Sunday Ushers", location: "Sanctuary", group: { id: "group-1", name: "Ushers" } }
        }
      },
      individual: { id: "member-1", memberNumber: 42, firstName: "Alex", lastName: null, family: { lastName: "Johnson" } }
    });
    expect(row).toMatchObject({
      memberName: "Alex Johnson",
      serviceOpportunity: "Sunday Ushers",
      serviceGroup: "Ushers",
      serviceOutcome: "COMPLETED",
      minutesServed: 75
    });
  });
});
