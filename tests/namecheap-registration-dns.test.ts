import { beforeEach, describe, expect, it, vi } from "vitest";

const dbNamecheap = vi.hoisted(() => ({ namecheapConfiguration: { findUnique: vi.fn() } }));

vi.mock("@/lib/db", () => ({ db: dbNamecheap }));
vi.mock("@/lib/app-config", () => ({ decryptConfig: (value: string) => value, encryptConfig: (value: string) => value }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin: vi.fn(), buildGlobalAuditDetails: vi.fn(() => "details") }));

describe("Namecheap registration DNS", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dbNamecheap.namecheapConfiguration.findUnique.mockResolvedValue({
      apiUserEncrypted: "api-user",
      apiKeyEncrypted: "api-key",
      usernameEncrypted: "username",
      clientIp: "203.0.113.5",
      registrationDnsRecords: [{ host: "@", type: "A", address: "203.0.113.10", ttl: 300 }],
      autoVerificationRecord: true
    });
  });

  it("adds configured records and the generated verification TXT record to a newly registered domain", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response('<ApiResponse Status="OK"><CommandResponse><DomainDNSGetHostsResult><host HostId="1" Name="@" Type="URL" Address="http://parking" TTL="1800"/></DomainDNSGetHostsResult></CommandResponse></ApiResponse>')).mockResolvedValueOnce(new Response('<ApiResponse Status="OK"><CommandResponse><DomainDNSSetHostsResult/></CommandResponse></ApiResponse>'));
    const { provisionRegisteredDomainDns } = await import("@/lib/namecheap");

    await expect(provisionRegisteredDomainDns("example.org", "verification-token")).resolves.toMatchObject({ state: "PROVISIONED" });
    const setHostsUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(setHostsUrl.searchParams.get("SLD")).toBe("example");
    expect(setHostsUrl.searchParams.get("TLD")).toBe("org");
    expect(setHostsUrl.searchParams.get("HostName1")).toBe("@");
    expect(setHostsUrl.searchParams.get("RecordType1")).toBe("URL");
    expect(setHostsUrl.searchParams.get("HostName2")).toBe("@");
    expect(setHostsUrl.searchParams.get("RecordType2")).toBe("A");
    expect(setHostsUrl.searchParams.get("HostName3")).toBe("_mychurch-verification");
    expect(setHostsUrl.searchParams.get("RecordType3")).toBe("TXT");
    expect(setHostsUrl.searchParams.get("Address3")).toBe("verification-token");
  });
});
