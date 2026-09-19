import { describe, expect, it } from "vitest";
import { buildGlobalAuditDetails, hasRecentReauthentication, isActiveSelectedChurch, isGlobalAdminSession } from "@/lib/global-admin";

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
});
