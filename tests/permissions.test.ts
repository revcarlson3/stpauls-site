import { describe, expect, it } from "vitest";
import type { Permission } from "@prisma/client";
import { canAccessAdmin, hasEffectivePermission } from "@/lib/permissions";

describe("effective security-group permissions", () => {
  it("keeps Visitor and Church Member outside the admin area", () => {
    expect(canAccessAdmin([])).toBe(false);
    expect(canAccessAdmin(["MY_MEMBERSHIP"])).toBe(false);
  });

  it("allows functional administrators into the admin area", () => {
    expect(canAccessAdmin(["MANAGE_MEMBERSHIP"])).toBe(true);
    expect(canAccessAdmin(["EDIT_PAGES"])).toBe(true);
  });

  it("checks the effective permission set rather than the real group", () => {
    const previewPermissions: Permission[] = ["MANAGE_MEMBERSHIP"];
    expect(hasEffectivePermission(previewPermissions, "MANAGE_MEMBERSHIP")).toBe(true);
    expect(hasEffectivePermission(previewPermissions, "MANAGE_USERS")).toBe(false);
  });
});
