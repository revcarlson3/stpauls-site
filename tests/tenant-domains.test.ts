import { describe, expect, it } from "vitest";
import { buildDomainVerificationRecord, dnsTxtRecordMatches, tenantDomainWhere } from "@/lib/domain-provider";

describe("tenant domain access", () => {
  it("always scopes domain queries to the authenticated church", () => {
    expect(tenantDomainWhere("church-a")).toEqual({ churchId: "church-a" });
    expect(tenantDomainWhere("church-a")).not.toEqual({ churchId: "church-b" });
  });

  it("builds the DNS record needed to verify an external domain", () => {
    expect(buildDomainVerificationRecord("www.example.org", "token-123")).toEqual({
      type: "TXT",
      name: "_mychurch-verification.www.example.org",
      value: "token-123"
    });
    expect(buildDomainVerificationRecord("www.example.org", null)).toBeNull();
  });

  it("matches TXT records even when DNS splits a value into chunks", () => {
    expect(dnsTxtRecordMatches([["token-", "123"], ["other"]], "token-123")).toBe(true);
    expect(dnsTxtRecordMatches([["token-12"]], "token-123")).toBe(false);
  });
});
