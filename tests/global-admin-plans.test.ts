import { describe, expect, it } from "vitest";

describe("global admin subscription plans", () => {
  it("validates normalized pricing, custom-domain add-ons, and sanitized content", async () => {
    const { validatePlanInput } = await import("@/lib/global-admin-plans");
    const { normalizePlanEditorState } = await import("@/lib/plan-editor");
    const value = validatePlanInput({
      name: "Growth",
      slug: "Growth-Plan",
      price: 19.99,
      interval: "QUARTERLY",
      currency: "eur",
      description: '<p>Good</p><script>alert("x")</script>',
      entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON", addOnMonthly: "4.00", addOnAnnual: "40.00" }]
    });
    expect(value.slug).toBe("growth-plan");
    expect(value.currency).toBe("EUR");
    expect(value.interval).toBe("QUARTERLY");
    expect(validatePlanInput({ name: "Monthly", slug: "monthly", price: 10, interval: "monthly" }).interval).toBe("MONTHLY");
    expect(normalizePlanEditorState({ id: "legacy", interval: null, price: null, monthlyPrice: "10.00" })).toMatchObject({ interval: "MONTHLY", price: "10.00" });
    for (const interval of ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]) {
      expect(validatePlanInput({ name: "Plan", slug: `plan-${interval.toLowerCase().replace("_", "-")}`, price: 1, interval }).interval).toBe(interval);
    }
    expect(value.description).not.toContain("<script>");
    expect(value.entitlements[0]).toMatchObject({ moduleSlug: "custom-domains", mode: "PAID_ADD_ON" });
    expect(validatePlanInput({ name: "Quarterly", slug: "quarterly", price: 12, interval: "QUARTERLY", entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON", addOnPrice: "5.00" }] }).entitlements[0]).toMatchObject({ addOnMonthly: 5, addOnAnnual: 5 });
    expect(validatePlanInput({ name: "Quarterly", slug: "quarterly", price: 12, interval: "QUARTERLY", entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON", addOnMonthly: "5.00" }] }).entitlements[0]).toMatchObject({ addOnMonthly: 5, addOnAnnual: 5 });
    expect(() => validatePlanInput({ name: "Quarterly", slug: "quarterly", price: 12, interval: "QUARTERLY", entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON" }] })).toThrow("selected billing interval");
    expect(() => validatePlanInput({ name: "Quarterly", slug: "quarterly", price: 12, interval: "QUARTERLY", entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON", addOnPrice: null }] })).toThrow("selected billing interval");
    expect(() => validatePlanInput({ name: "Quarterly", slug: "quarterly", price: 12, interval: "QUARTERLY", entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON", addOnPrice: "-1" }] })).toThrow("non-negative");
    expect(() => validatePlanInput({ name: "Bad", slug: "bad", price: -1, interval: "MONTHLY" })).toThrow();
    expect(() => validatePlanInput({ name: "Bad", slug: "bad", price: 1, interval: "MONTHLY", entitlements: [{ moduleSlug: "unknown", mode: "INCLUDED" }] })).toThrow();
    expect(() => validatePlanInput({ name: "Bad", slug: "bad", price: 1, interval: "MONTHLY", entitlements: [{ moduleSlug: "custom-domains", mode: "PAID_ADD_ON", addOnMonthly: "", addOnAnnual: "" }] })).toThrow();
  });
});
