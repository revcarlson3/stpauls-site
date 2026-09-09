import { describe, expect, it } from "vitest";
import { advanceGradeLevel, estimateGradeLevel, isSchoolGradeLevel } from "@/lib/membership-grade-levels";

describe("membership grade levels", () => {
  it("estimates a grade using age on the current school-year start", () => {
    expect(estimateGradeLevel(new Date("2018-06-15T00:00:00Z"), new Date("2026-09-09T00:00:00Z"))).toBe("3rd grade");
    expect(estimateGradeLevel(new Date("2021-10-15T00:00:00Z"), new Date("2026-09-09T00:00:00Z"))).toBe("Preschool");
    expect(estimateGradeLevel(new Date("2008-05-15T00:00:00Z"), new Date("2026-09-09T00:00:00Z"))).toBe("College");
  });

  it("advances only school-grade values", () => {
    expect(advanceGradeLevel("Kindergarten")).toBe("1st grade");
    expect(advanceGradeLevel("11th grade")).toBe("12th grade");
    expect(advanceGradeLevel("12th grade")).toBeNull();
    expect(advanceGradeLevel("Adult")).toBeNull();
    expect(isSchoolGradeLevel("5th grade")).toBe(true);
    expect(isSchoolGradeLevel("College")).toBe(false);
  });
});
