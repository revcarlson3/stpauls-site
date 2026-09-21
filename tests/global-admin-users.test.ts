import { describe, expect, it } from "vitest";
import { buildUserAuditDetails, isUserInSelectedChurch, userSessionState } from "@/lib/global-admin-users";

describe("selected-site user security", () => {
  it("keeps user reads scoped to the selected church membership", () => {
    expect(isUserInSelectedChurch(["church-a", "church-b"], "church-a")).toBe(true);
    expect(isUserInSelectedChurch(["church-a"], "church-b")).toBe(false);
  });

  it("reports session state without exposing internal identifiers", () => {
    expect(userSessionState(null, null)).toBe("No recorded session");
    expect(userSessionState(new Date("2026-01-02"), null)).toBe("Active or expired");
    expect(userSessionState(new Date("2026-01-02"), new Date("2026-01-03"))).toBe("Revoked");
  });

  it("includes selected-site audit context for mutations", () => {
    expect(JSON.parse(buildUserAuditDetails("church-a", "user-a", { action: "deactivate" }))).toEqual({
      boundary: "global-admin",
      selectedChurchId: "church-a",
      targetType: "user",
      targetId: "user-a",
      metadata: { action: "deactivate" }
    });
  });
});
