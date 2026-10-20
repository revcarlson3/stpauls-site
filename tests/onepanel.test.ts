import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

const db = vi.hoisted(() => ({
  onePanelConfiguration: { findUnique: vi.fn(), upsert: vi.fn() }
}));
const requireGlobalAdmin = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({
  requireGlobalAdmin,
  buildGlobalAuditDetails: vi.fn(() => "{}")
}));
vi.mock("@/lib/app-config", () => ({
  decryptConfig: vi.fn(() => "api-key"),
  encryptConfig: vi.fn((value: string) => `encrypted:${value}`)
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

function response(body: string, contentType = "application/json") {
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

function failureResponse(body: string, status = 500) {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

describe("1Panel API compatibility", () => {
  it("uses the v1 endpoint and legacy MD5 authentication for 1.x", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({ baseUrl: "https://panel.example.test/secure", apiKeyEncrypted: "encrypted", version: "1.10.34-lts" });
    const fetchMock = vi.fn().mockResolvedValue(response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const { testOnePanelConnection } = await import("@/lib/onepanel");
    await testOnePanelConnection();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://panel.example.test/secure/api/v1/toolbox/device/base");
    const timestamp = (options.headers as Record<string, string>)["1Panel-Timestamp"];
    expect((options.headers as Record<string, string>)["1Panel-Token"]).toBe(crypto.createHash("md5").update(`1panelapi-key${timestamp}`).digest("hex"));
  });

  it("uses v2 HMAC first and falls back to legacy MD5", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({ baseUrl: "https://panel.example.test", apiKeyEncrypted: "encrypted", version: "2.0.0" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response("not-json", "text/plain"))
      .mockResolvedValueOnce(response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const { testOnePanelConnection } = await import("@/lib/onepanel");
    await testOnePanelConnection();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = fetchMock.mock.calls[0][1] as RequestInit;
    const second = fetchMock.mock.calls[1][1] as RequestInit;
    const firstHeaders = first.headers as Record<string, string>;
    const secondHeaders = second.headers as Record<string, string>;
    expect(fetchMock.mock.calls[0][0]).toBe("https://panel.example.test/api/v2/toolbox/device/base");
    expect(fetchMock.mock.calls[1][0]).toBe("https://panel.example.test/api/v2/toolbox/device/base");
    expect(firstHeaders["1Panel-Token"]).toBe(crypto.createHmac("sha256", "api-key").update(`1panel:${firstHeaders["1Panel-Timestamp"]}`).digest("hex"));
    expect(secondHeaders["1Panel-Token"]).toBe(crypto.createHash("md5").update(`1panelapi-key${secondHeaders["1Panel-Timestamp"]}`).digest("hex"));
  });

  it("requests a Let’s Encrypt certificate and attaches it to the configured website", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({
      baseUrl: "https://panel.example.test",
      apiKeyEncrypted: "encrypted",
      version: "2.0.0",
      websiteId: 7,
      acmeAccountId: 11,
      dnsAccountId: 12,
      wildcardSslId: 13,
      platformSuffix: "mychurch.one"
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response("{}"))
      .mockResolvedValueOnce(response('{"data":[{"domain":"www.example.org:80"}]}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":11}]}}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":12}]}}'))
      .mockResolvedValueOnce(response('{"data":{"id":42}}'))
      .mockResolvedValueOnce(response('{"data":{"status":"ready"}}'))
      .mockResolvedValueOnce(response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const { provisionCustomDomainTls } = await import("@/lib/onepanel");
    await expect(provisionCustomDomainTls("www.example.org")).resolves.toEqual({ certificateId: 42, websiteId: 7 });

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls[0][0]).toBe("https://panel.example.test/api/v2/websites/domains");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      websiteID: 7,
      domains: "www.example.org"
    });
    expect(fetchMock.mock.calls[1][0]).toBe("https://panel.example.test/api/v2/websites/domains/7");
    expect(fetchMock.mock.calls[2][0]).toBe("https://panel.example.test/api/v2/websites/acme/search");
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toMatchObject({ page: 1, pageSize: 100 });
    expect(fetchMock.mock.calls[3][0]).toBe("https://panel.example.test/api/v2/websites/dns/search");
    expect(JSON.parse((fetchMock.mock.calls[3][1] as RequestInit).body as string)).toMatchObject({ page: 1, pageSize: 100 });
    expect(fetchMock.mock.calls[4][0]).toBe("https://panel.example.test/api/v2/websites/ssl");
    expect(JSON.parse((fetchMock.mock.calls[4][1] as RequestInit).body as string)).toMatchObject({
      primaryDomain: "www.example.org",
      provider: "dnsAccount",
      acmeAccountId: 11,
      dnsAccountId: 12,
      autoRenew: true
    });
    expect(fetchMock.mock.calls[5][0]).toBe("https://panel.example.test/api/v2/websites/ssl/42");
    expect((fetchMock.mock.calls[5][1] as RequestInit).method).toBe("GET");
    expect(JSON.parse((fetchMock.mock.calls[6][1] as RequestInit).body as string)).toMatchObject({
      ids: [7],
      websiteSSLId: 42,
      type: "existed",
      httpConfig: "HTTPToHTTPS"
    });
  });

  it("accepts string and alternate certificate ID fields from 1Panel", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({
      baseUrl: "https://panel.example.test",
      apiKeyEncrypted: "encrypted",
      version: "1.10.34-lts",
      websiteId: "7",
      acmeAccountId: "11",
      dnsAccountId: "12",
      wildcardSslId: null,
      platformSuffix: "mychurch.one"
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response("{}"))
      .mockResolvedValueOnce(response('{"data":[{"domain":"www.example.org"}]}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":11}]}}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":12}]}}'))
      .mockResolvedValueOnce(response('{"data":{"sslId":"42"}}'))
      .mockResolvedValueOnce(response('{"data":{"status":"ready"}}'))
      .mockResolvedValueOnce(response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const { provisionCustomDomainTls } = await import("@/lib/onepanel");
    await expect(provisionCustomDomainTls("www.example.org")).resolves.toEqual({ certificateId: 42, websiteId: 7 });
  });

  it("identifies a domain-binding failure before attempting certificate creation", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({
      baseUrl: "https://panel.example.test",
      apiKeyEncrypted: "encrypted",
      version: "1.10.34-lts",
      websiteId: "7",
      acmeAccountId: "11",
      dnsAccountId: "12",
      wildcardSslId: null,
      platformSuffix: "mychurch.one"
    });
    const fetchMock = vi.fn().mockResolvedValue(failureResponse('{"message":"website domain creation failed"}'));
    vi.stubGlobal("fetch", fetchMock);

    const { provisionCustomDomainTls } = await import("@/lib/onepanel");
    await expect(provisionCustomDomainTls("www.example.org")).rejects.toThrow(
      "1Panel domain binding failed (500): website domain creation failed"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("continues with SSL when 1Panel reports an existing domain in Chinese", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({
      baseUrl: "https://panel.example.test",
      apiKeyEncrypted: "encrypted",
      version: "1.10.34-lts",
      websiteId: "7",
      acmeAccountId: "11",
      dnsAccountId: "12",
      wildcardSslId: null,
      platformSuffix: "mychurch.one"
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(failureResponse('{"message":"域名已存在"}', 400))
      .mockResolvedValueOnce(response('{"data":[{"domain":"www.example.org"}]}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":11}]}}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":12}]}}'))
      .mockResolvedValueOnce(response('{"data":{"id":42}}'))
      .mockResolvedValueOnce(response('{"data":{"status":"ready"}}'))
      .mockResolvedValueOnce(response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const { provisionCustomDomainTls } = await import("@/lib/onepanel");
    await expect(provisionCustomDomainTls("www.example.org")).resolves.toEqual({ certificateId: 42, websiteId: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls[1][0]).toBe("https://panel.example.test/api/v1/websites/domains/7");
  });

  it("rejects a Let's Encrypt URL account number that is not a local 1Panel account", async () => {
    db.onePanelConfiguration.findUnique.mockResolvedValue({
      baseUrl: "https://panel.example.test",
      apiKeyEncrypted: "encrypted",
      version: "1.10.34-lts",
      websiteId: "7",
      acmeAccountId: "3761153346",
      dnsAccountId: "12",
      wildcardSslId: null,
      platformSuffix: "mychurch.one"
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response("{}"))
      .mockResolvedValueOnce(response('{"data":[{"domain":"www.example.org"}]}'))
      .mockResolvedValueOnce(response('{"data":{"items":[{"id":11}]}}'));
    vi.stubGlobal("fetch", fetchMock);

    const { provisionCustomDomainTls } = await import("@/lib/onepanel");
    await expect(provisionCustomDomainTls("www.example.org")).rejects.toThrow(
      "local 1Panel ACME account ID, not the account number from the Let's Encrypt URL"
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
