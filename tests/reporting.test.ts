import { describe, expect, it } from "vitest";
import {
  getReportDefinition,
  getReportDefinitionByKey,
  listReportDefinitions
} from "@/lib/reporting";
import { canAccessTenant } from "@/lib/tenant";

describe("central reporting registry", () => {
  it("registers every supported module adapter and report type", () => {
    expect(getReportDefinition("membership", "membership-overview")).toMatchObject({
      key: "membership:membership-overview",
      module: "membership",
      permission: "MANAGE_MEMBERSHIP",
      tenantScope: "PLATFORM_ADMIN_CROSS_TENANT"
    });
    expect(getReportDefinition("events", "attendance")?.permission).toBe("MANAGE_EVENTS");
    expect(getReportDefinition("accounting", "treasurer")?.permission).toBe("MANAGE_ACCOUNTING");
    expect(getReportDefinition("giving", "contribution-statements")?.permission).toBe("MANAGE_GIVING");
    expect(getReportDefinition("giving", "not-a-report")).toBeUndefined();
  });

  it("supports stable keys and module filtering for future global selection", () => {
    const definitions = listReportDefinitions();
    expect(definitions.length).toBeGreaterThan(10);
    expect(listReportDefinitions("accounting").every((definition) => definition.module === "accounting")).toBe(true);
    expect(getReportDefinitionByKey("giving:contribution-statements")?.reportType).toBe("contribution-statements");
  });

  it("keeps ordinary users in their current tenant", () => {
    expect(canAccessTenant({ isPlatformAdmin: false }, "church-a", "church-a")).toBe(true);
    expect(canAccessTenant({ isPlatformAdmin: false }, "church-a", "church-b")).toBe(false);
    expect(canAccessTenant({ isPlatformAdmin: true }, "church-a", "church-b")).toBe(true);
  });
});
