import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

const db = vi.hoisted(() => ({
  onePanelConfiguration: { findUnique: vi.fn() }
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
});
