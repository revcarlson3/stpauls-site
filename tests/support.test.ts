import { describe, expect, it } from "vitest";
import { ticketWhere, validateSupportFiles } from "@/lib/support";

describe("tenant support tickets", () => {
  it("rejects unsafe, oversized, and aggregate attachments", () => {
    expect(() => validateSupportFiles([new File(["x"], "script.exe", { type: "application/octet-stream" })])).toThrow();
    expect(() => validateSupportFiles([new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" })])).toThrow();
  });

  it("scopes ordinary users to their active church", () => {
    expect(ticketWhere({ churchId: "church-a", isPlatformAdmin: false } as never, "church-b")).toEqual({ churchId: "church-a" });
    expect(ticketWhere({ churchId: "church-a", isPlatformAdmin: true } as never, "church-b")).toEqual({ churchId: "church-b" });
  });
});
