import { afterEach, describe, expect, it } from "vitest";

describe("billing checkout return URLs", () => {
  afterEach(() => {
    delete process.env.BILLING_CHECKOUT_SUCCESS_URL;
    delete process.env.BILLING_CHECKOUT_CANCEL_URL;
    delete process.env.NEXTAUTH_URL;
  });

  it("uses the explicit success URL when configured", async () => {
    process.env.BILLING_CHECKOUT_SUCCESS_URL = "https://tenant.example/checkout-complete";
    const { checkoutReturnUrl } = await import("@/lib/billing-providers");
    expect(checkoutReturnUrl("BILLING_CHECKOUT_SUCCESS_URL")).toBe("https://tenant.example/checkout-complete");
  });

  it("falls back to the configured application URL for provider returns", async () => {
    process.env.NEXTAUTH_URL = "https://beta.mychurch.one";
    const { checkoutReturnUrl } = await import("@/lib/billing-providers");
    expect(checkoutReturnUrl("BILLING_CHECKOUT_SUCCESS_URL")).toBe("https://beta.mychurch.one/admin/billing");
    expect(checkoutReturnUrl("BILLING_CHECKOUT_CANCEL_URL")).toBe("https://beta.mychurch.one/admin/billing");
  });
});
