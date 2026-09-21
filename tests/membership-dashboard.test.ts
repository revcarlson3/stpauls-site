import { describe, expect, it } from "vitest";
import {
  annualDateKeys,
  anniversaryDisplayName,
  anniversaryYears,
  missingProfileFields,
  nextAnnualOccurrence,
  normalizeDashboardLayout,
  percentage,
  periodComparison
} from "@/lib/membership-dashboard";

describe("membership dashboard date windows", () => {
  it("builds bounded annual keys across a year boundary", () => {
    expect(annualDateKeys(new Date("2026-12-30T18:00:00.000Z"), 3)).toEqual([
      "12-30",
      "12-31",
      "01-01",
      "01-02"
    ]);
  });

  it("selects the next annual occurrence and calculates anniversary years", () => {
    const original = new Date("2010-01-02T00:00:00.000Z");
    const occurrence = nextAnnualOccurrence(original, new Date("2026-12-30T00:00:00.000Z"));
    expect(occurrence.toISOString()).toBe("2027-01-02T00:00:00.000Z");
    expect(anniversaryYears(original, occurrence)).toBe(17);
  });

  it("formats anniversaries with the head of household first and a single-person fallback", () => {
    expect(anniversaryDisplayName([
      { id: "spouse", firstName: "Nicole", familyLastName: "Hill", familyRoleSlug: "spouse" },
      { id: "head", firstName: "Shane", familyLastName: "Hill", familyRoleSlug: "head-of-household" }
    ])).toBe("Shane & Nicole Hill");
    expect(anniversaryDisplayName([
      { id: "member", firstName: "Shane", familyLastName: "Hill", familyRoleSlug: "head-of-household" }
    ])).toBe("Shane Hill");
  });
});

describe("membership dashboard summaries", () => {
  it("identifies only missing essential profile areas", () => {
    expect(missingProfileFields({
      email: null,
      cellphone: " ",
      otherPhone: null,
      family: {
        email: null,
        phone: null,
        addressStreet: "123 Main St",
        addressCity: "Hillside",
        addressState: null,
        addressZip: "12345"
      }
    })).toEqual(["email", "phone", "address"]);

    expect(missingProfileFields({
      email: null,
      cellphone: null,
      otherPhone: null,
      family: {
        email: "family@example.com",
        phone: "5551234567",
        addressStreet: "123 Main St",
        addressCity: "Hillside",
        addressState: "IL",
        addressZip: "12345"
      }
    })).toEqual([]);
  });

  it("returns stable percentages for empty and populated groups", () => {
    expect(percentage(0, 0)).toBe(0);
    expect(percentage(7, 9)).toBe(78);
    expect(percentage(12, 9)).toBe(100);
    expect(percentage(-1, 9)).toBe(0);
  });

  it("calculates current-versus-prior changes without an infinite zero baseline", () => {
    expect(periodComparison(75, 60)).toEqual({
      current: 75,
      prior: 60,
      change: 15,
      changePercent: 25
    });
    expect(periodComparison(5, 0)).toEqual({
      current: 5,
      prior: 0,
      change: 5,
      changePercent: null
    });
  });

  it("normalizes saved layouts to supported blocks and values", () => {
    expect(normalizeDashboardLayout({
      order: ["volunteer", "volunteer", "unknown", "birthdays"],
      visible: { birthdays: false, volunteer: "no", unknown: true },
      widths: { birthdays: "full", volunteer: "wide", unknown: "half" }
    })).toEqual({
      order: ["volunteer", "birthdays", "anniversaries", "profiles", "engagement"],
      visible: {
        birthdays: false,
        anniversaries: true,
        profiles: true,
        engagement: true,
        volunteer: true
      },
      widths: {
        birthdays: "full",
        anniversaries: "half",
        profiles: "half",
        engagement: "full",
        volunteer: "full"
      }
    });
  });
});
