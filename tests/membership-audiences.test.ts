import { describe, expect, it } from "vitest";
import { databaseDynamicWhere, dynamicWhere, normalizeCriteria } from "@/lib/membership-audiences";

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

  it("compiles safe report criteria and list membership into a database query", () => {
    expect(databaseDynamicWhere({
      conditions: [
        { field: "status", operator: "equals", value: "ACTIVE" },
        { field: "city", operator: "contains", value: "Hill" }
      ],
      sourceType: "manual-list",
      sourceId: "list-1"
    })).toEqual({
      AND: [
        { status: "ACTIVE" },
        {
          AND: [
            { status: "ACTIVE" },
            { family: { addressCity: { contains: "Hill", mode: "insensitive" } } }
          ]
        },
        { manualLists: { some: { listId: "list-1" } } }
      ]
    });
  });

  it("falls back when criteria require in-memory date or dynamic-list evaluation", () => {
    expect(databaseDynamicWhere({
      conditions: [{ field: "birthdayMonth", operator: "monthEquals", value: "9" }]
    })).toBeNull();
    expect(databaseDynamicWhere({ sourceType: "dynamic-list", sourceId: "list-1" })).toBeNull();
  });
});
