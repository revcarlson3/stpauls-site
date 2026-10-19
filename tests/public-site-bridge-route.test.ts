import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public-site-bridge", () => ({
  createPublicSiteSessionToken: vi.fn().mockResolvedValue("session-token")
}));

import { GET } from "@/app/(public)/auth/bridge/route";

describe("public-site bridge route", () => {
  it("redirects to the forwarded public host instead of the internal app origin", async () => {
    const response = await GET(new Request("http://0.0.0.0:3000/auth/bridge?token=bridge-token", {
      headers: {
        host: "mychurch-beta-7b46.mychurch.one",
        "x-forwarded-host": "mychurch-beta-7b46.mychurch.one",
        "x-forwarded-proto": "https"
      }
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://mychurch-beta-7b46.mychurch.one/");
  });
});
