import { describe, expect, it } from "vitest";
import { dynamicWhere, normalizeCriteria } from "@/lib/membership-audiences";

describe("membership audience criteria", () => {
  it("normalizes query-builder conditions and match mode", () => {
    expect(normalizeCriteria({
      match: "any",
      conditions: [
        { field: " birthdayMonth ", operator: "monthGreaterOrEqual", value: "2" },
        { field: "deceasedDate", operator: "isNotSet", value: "" }
      ]
    })).toEqual({
      match: "any",
      conditions: [
        { field: "birthdayMonth", operator: "monthGreaterOrEqual", value: "2" },
        { field: "deceasedDate", operator: "isNotSet", value: "" }
      ]
    });
  });

  it("keeps removed members out of dynamic-list database candidates by default", () => {
    expect(dynamicWhere({ conditions: [{ field: "city", operator: "contains", value: "Saint" }] })).toEqual({
      status: { not: "REMOVED" }
    });
    expect(dynamicWhere({ status: "ACTIVE" })).toEqual({ status: "ACTIVE" });
  });
});
