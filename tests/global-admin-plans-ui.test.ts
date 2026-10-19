import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global admin plan editor accessibility", () => {
  it("labels every plan setup control", () => {
    const source = readFileSync("app/global-admin/billing/plans/workspace.tsx", "utf8");
    for (const id of ["plan-name", "plan-slug", "plan-price", "plan-interval", "plan-currency", "plan-trial-days", "plan-sort-order", "plan-active", "plan-description", "custom-domain-mode", "custom-domain-price"]) {
      expect(source).toContain(`id="${id}"`);
    }
    expect(source).toContain("Entitlement/module controls");
    expect(source).toContain("Custom domains paid add-on");
  });
});
