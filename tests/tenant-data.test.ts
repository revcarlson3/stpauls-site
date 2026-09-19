import { describe, expect, it } from "vitest";
import { selectBackfillChurch, tenantFilter } from "@/lib/tenant-data";

describe("tenant data helpers", () => {
  it("prefers an active church for legacy backfills", () => {
    expect(selectBackfillChurch([
      { id: "old", status: "SUSPENDED", createdAt: new Date("2020-01-01") },
      { id: "active", status: "ACTIVE", createdAt: new Date("2024-01-01") }
    ])).toBe("active");
  });

  it("falls back to the oldest church when none is active", () => {
    expect(selectBackfillChurch([
      { id: "new", status: "SUSPENDED", createdAt: new Date("2024-01-01") },
      { id: "old", status: "SUSPENDED", createdAt: new Date("2020-01-01") }
    ])).toBe("old");
    expect(selectBackfillChurch([])).toBeNull();
  });

  it("produces an exact tenant predicate", () => {
    expect(tenantFilter("church-1")).toEqual({ churchId: "church-1" });
  });
});
