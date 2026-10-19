import { describe, expect, it } from "vitest";
import { tenantDomainWhere } from "@/lib/domain-provider";

describe("tenant domain access", () => {
  it("always scopes domain queries to the authenticated church", () => {
    expect(tenantDomainWhere("church-a")).toEqual({ churchId: "church-a" });
    expect(tenantDomainWhere("church-a")).not.toEqual({ churchId: "church-b" });
  });
});
