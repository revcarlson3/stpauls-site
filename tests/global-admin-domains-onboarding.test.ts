import { describe, expect, it } from "vitest";
import { buildPlatformHostname, isSelectedSiteDomain, manualDomainStatus, normalizeHostname, primaryDomainIsSelectable } from "@/lib/global-admin-domains";
import { onboardingStatusForStep, validateOnboardingTransition } from "@/lib/global-admin-onboarding";

describe("global admin domain controls", () => {
  it("normalizes safe hostnames and rejects URLs or malformed labels", () => {
    expect(normalizeHostname("  WWW.Example.ORG. ")).toBe("www.example.org");
    expect(normalizeHostname("https://example.org")).toBeNull();
    expect(normalizeHostname("bad label.example.org")).toBeNull();
    expect(normalizeHostname("-bad.example.org")).toBeNull();
  });

  it("keeps unavailable verification explicitly pending", () => {
    const checked = manualDomainStatus(new Date("2026-01-01T00:00:00.000Z"));
    expect(checked.status).toBe("VERIFYING");
    expect(checked.tlsStatus).toBe("MANUAL_VERIFICATION_REQUIRED");
    expect(checked.lastError).toContain("not configured");
  });

  it("does not treat another site's domain as selected", () => {
    expect(isSelectedSiteDomain("site-a", "site-a")).toBe(true);
    expect(isSelectedSiteDomain("site-b", "site-a")).toBe(false);
  });

  it("builds a platform hostname from the site slug and configured suffix", () => {
    expect(buildPlatformHostname("st-pauls-downtown", "mychurch.one", "9782")).toBe("st-pauls-downtown-9782.mychurch.one");
  });

  it("only allows active domains from the selected site to become primary", () => {
    expect(primaryDomainIsSelectable({ churchId: "site-a", status: "ACTIVE" }, "site-a")).toBe(true);
    expect(primaryDomainIsSelectable({ churchId: "site-a", status: "VERIFYING" }, "site-a")).toBe(false);
    expect(primaryDomainIsSelectable({ churchId: "site-b", status: "ACTIVE" }, "site-a")).toBe(false);
  });
});

describe("global admin onboarding controls", () => {
  it("requires sequential completion", () => {
    expect(validateOnboardingTransition({ currentStep: "ACCOUNT", nextStep: "SECURITY", siteIdentityDone: true, modulesDone: true, securityDone: false })).toContain("advance in order");
    expect(validateOnboardingTransition({ currentStep: "ACCOUNT", nextStep: "SITE_IDENTITY", siteIdentityDone: false, modulesDone: false, securityDone: false })).toBeNull();
    expect(validateOnboardingTransition({ currentStep: "SECURITY", nextStep: "COMPLETE", siteIdentityDone: true, modulesDone: true, securityDone: false })).toContain("all onboarding");
  });

  it("maps steps to lifecycle-compatible onboarding status", () => {
    expect(onboardingStatusForStep("SITE_IDENTITY")).toBe("SITE_SETUP");
    expect(onboardingStatusForStep("MODULES")).toBe("IN_PROGRESS");
    expect(onboardingStatusForStep("COMPLETE")).toBe("COMPLETE");
  });
});
