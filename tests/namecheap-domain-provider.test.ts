import { describe, expect, it } from "vitest";
import { parseDomainAvailability, parseRegistrationDnsRecords, parseTransferList, parseTransferStatus } from "@/lib/namecheap";

describe("Namecheap domain XML parsing", () => {
  it("parses availability and premium pricing metadata", () => {
    const result = parseDomainAvailability('<ApiResponse Status="OK"><CommandResponse><DomainCheckResult Domain="example.test" Available="true" IsPremiumName="true" PremiumRegistrationPrice="12.00"/></CommandResponse></ApiResponse>');
    expect(result).toEqual([{ domain: "example.test", available: true, premium: true, registrationPrice: "12.00" }]);
  });

  it("parses transfer status without exposing unrelated XML", () => {
    expect(parseTransferStatus('<ApiResponse Status="OK"><CommandResponse><DomainTransferGetStatusResult TransferID="42" StatusID="2" Status="Queued for submission"/></CommandResponse></ApiResponse>')).toEqual({ transferId: "42", statusId: "2", status: "Queued for submission" });
  });

  it("parses transfer list rows", () => {
    expect(parseTransferList('<ApiResponse Status="OK"><CommandResponse><TransferGetListResult><Transfer ID="42" Domainname="example.test" StatusID="2" Status="Queued" StatusDate="2026-09-26"/></TransferGetListResult></CommandResponse></ApiResponse>')).toEqual([{ transferId: "42", domain: "example.test", statusId: "2", status: "Queued", statusDate: "2026-09-26" }]);
  });

  it("accepts the configurable records used for new registrations", () => {
    expect(parseRegistrationDnsRecords([
      { host: "@", type: "A", address: "203.0.113.10", ttl: 300 },
      { host: "www", type: "CNAME", address: "@", ttl: 600 }
    ])).toEqual([
      { host: "@", type: "A", address: "203.0.113.10", ttl: 300 },
      { host: "www", type: "CNAME", address: "@", ttl: 600 }
    ]);
    expect(parseRegistrationDnsRecords([{ host: "@", type: "A", address: "", ttl: 300 }])).toEqual([]);
  });
});
