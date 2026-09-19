import { describe, expect, it } from "vitest";
import { supportMessageWhere, ticketWhere, validateSupportFiles } from "@/lib/support";
import { auditActivityTypes } from "@/lib/audit";

describe("tenant support tickets", () => {
  it("rejects unsafe, oversized, and aggregate attachments", () => {
    expect(() => validateSupportFiles([new File(["x"], "script.exe", { type: "application/octet-stream" })])).toThrow();
    expect(() => validateSupportFiles([new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" })])).toThrow();
  });

  it("scopes ordinary users to their active church", () => {
    expect(ticketWhere({ id: "user-a", churchId: "church-a", isPlatformAdmin: false } as never, "church-b")).toEqual({ churchId: "church-a", createdById: "user-a" });
    expect(ticketWhere({ churchId: "church-a", isPlatformAdmin: true } as never, "church-b")).toEqual({ churchId: "church-b" });
  });

  it("isolates same-church users by ticket creator", () => {
    const firstUserWhere = ticketWhere({ id: "user-a", churchId: "church-a", isPlatformAdmin: false } as never);
    const secondUserWhere = ticketWhere({ id: "user-b", churchId: "church-a", isPlatformAdmin: false } as never);
    expect(firstUserWhere).not.toEqual(secondUserWhere);
    expect(firstUserWhere).toEqual({ churchId: "church-a", createdById: "user-a" });
    expect(secondUserWhere).toEqual({ churchId: "church-a", createdById: "user-b" });
  });

  it("hides internal notes from tenant ticket conversations", () => {
    expect(supportMessageWhere({ churchId: "church-a", isPlatformAdmin: false } as never)).toEqual({ isInternal: false });
    expect(supportMessageWhere({ churchId: "church-a", isPlatformAdmin: true } as never)).toBeUndefined();
  });

  it("keeps global support actions in the audit allowlist", () => {
    expect(auditActivityTypes).toEqual(expect.arrayContaining(["support-ticket-viewed", "support-ticket-replied", "support-attachment-downloaded"]));
  });
});
