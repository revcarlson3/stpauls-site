import { describe, expect, it } from "vitest";
import { buildGlobalAuditDetails, hasRecentReauthentication, isActiveSelectedChurch, isGlobalAdminSession, lifecycleAuditMetadata, nextLifecycleState } from "@/lib/global-admin";

describe("global administrator bridge authorization", () => {
  it("accepts only a completed global-admin session", () => {
    expect(isGlobalAdminSession({ user: { authBoundary: "global-admin", mfaPending: false } })).toBe(true);
    expect(isGlobalAdminSession({ user: { authBoundary: "tenant-admin", mfaPending: false } })).toBe(false);
    expect(isGlobalAdminSession({ user: { authBoundary: "global-admin", mfaPending: true } })).toBe(false);
  });

  it("requires recent reauthentication for sensitive actions", () => {
    expect(hasRecentReauthentication(900, 1_000)).toBe(true);
    expect(hasRecentReauthentication(0, 1_000)).toBe(false);
    expect(hasRecentReauthentication(undefined, 1_000)).toBe(false);
  });

  it("does not accept a missing, suspended, or mismatched site context", () => {
    expect(isActiveSelectedChurch("church-1", { id: "church-1", status: "ACTIVE" })).toBe(true);
    expect(isActiveSelectedChurch(null, { id: "church-1", status: "ACTIVE" })).toBe(false);
    expect(isActiveSelectedChurch("church-2", { id: "church-1", status: "ACTIVE" })).toBe(false);
    expect(isActiveSelectedChurch("church-1", { id: "church-1", status: "SUSPENDED" })).toBe(false);
  });

  it("records bridge audit actor context fields without exposing labels", () => {
    expect(JSON.parse(buildGlobalAuditDetails({ churchId: "church-1", targetType: "user", targetId: "user-1", metadata: { action: "update" } }))).toEqual({
      boundary: "global-admin",
      selectedChurchId: "church-1",
      targetType: "user",
      targetId: "user-1",
      metadata: { action: "update" }
    });
  });

  it("allows only valid lifecycle transitions", () => {
      expect(nextLifecycleState({ lifecycleStatus: "DISABLED", onboardingStatus: "PENDING_VERIFICATION" }, "enable")?.lifecycleStatus).toBe("PROVISIONING");
      expect(nextLifecycleState({ lifecycleStatus: "PROVISIONING", onboardingStatus: "SITE_SETUP" }, "activate")?.lifecycleStatus).toBe("ACTIVE");
      expect(nextLifecycleState({ lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE" }, "suspend")?.lifecycleStatus).toBe("SUSPENDED");
      expect(nextLifecycleState({ lifecycleStatus: "SUSPENDED", onboardingStatus: "COMPLETE" }, "disable")?.lifecycleStatus).toBe("DISABLED");
      expect(nextLifecycleState({ lifecycleStatus: "DISABLED", onboardingStatus: "COMPLETE" }, "suspend")).toBeNull();
      expect(nextLifecycleState({ lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE" }, "activate")).toBeNull();
  });

  it("builds auditable lifecycle action metadata", () => {
      expect(lifecycleAuditMetadata("suspend", { lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE" }, { lifecycleStatus: "SUSPENDED", onboardingStatus: "COMPLETE" })).toEqual({
        action: "suspend",
        fromLifecycleStatus: "ACTIVE",
        toLifecycleStatus: "SUSPENDED",
        onboardingStatus: "COMPLETE"
    });
  });
});
