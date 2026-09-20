import { describe, expect, it } from "vitest";
import { canEditSecurityGroupPermissions, canRenameSecurityGroup, isSystemSecurityGroup } from "@/lib/security-group-policy";

describe("security-group permission switch policy", () => {
  it("keeps Visitor and Administrator permission baselines immutable", () => {
    expect(canEditSecurityGroupPermissions("visitor")).toBe(false);
    expect(canEditSecurityGroupPermissions("administrator")).toBe(false);
  });

  it("allows Church Member and Editor permission switches to be edited", () => {
    expect(canEditSecurityGroupPermissions("church-member")).toBe(true);
    expect(canEditSecurityGroupPermissions("editor")).toBe(true);
  });

  it("protects Church Member as a system group without locking its switches", () => {
    expect(isSystemSecurityGroup("church-member")).toBe(true);
    expect(canRenameSecurityGroup("church-member")).toBe(false);
    expect(canEditSecurityGroupPermissions("church-member")).toBe(true);
  });
});
