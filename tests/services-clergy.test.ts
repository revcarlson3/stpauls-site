import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sanitizeClergyBiographyHtml } from "@/lib/clergy-biography";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("services clergy foundation", () => {
  it("defines tenant-scoped membership-linked and independent clergy fields", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toContain("model ClergyProfile");
    expect(schema).toContain("membershipIndividualId String?               @unique");
    expect(schema).toContain("status                 ClergyProfileStatus");
    expect(schema).toContain("photographUrl          String?");
    expect(schema).toContain("clergyProfile              ClergyProfile?");
  });

  it("requires the services permission and preserves membership as the linked source", () => {
    const route = read("app/api/services/clergy/route.ts");
    expect(route).toContain('requirePermission("MANAGE_SERVICES")');
    expect(route).toContain('requireEnabledModule("services", user.id, "MANAGE_SERVICES")');
    expect(route).toContain("membershipIndividualId");
    expect(route).toContain("profileInclude");
    expect(route).toContain("Independent clergy records require first name, last name, and email address.");
  });

  it("exposes both membership-linked and independent creation paths in the admin form", () => {
    const page = read("app/admin/services/preachers-clergy/clergy-manager.tsx");
    expect(page).toContain('setMode("member")');
    expect(page).toContain('setMode("independent")');
    expect(page).toContain('name="membershipIndividualId"');
    expect(page).toContain('name="biography"');
    expect(page).toContain('name="photo"');
    expect(page).toContain("Custom photos override a linked membership photo.");
  });

  it("keeps clergy uploads isolated and validates type, size, and dimensions", () => {
    const route = read("app/api/services/clergy/route.ts");
    const photoRoute = read("app/api/services/clergy/[id]/photo/route.ts");
    const helper = read("lib/clergy-photo.ts");
    expect(helper).toContain('["image/jpeg", "image/png"]');
    expect(helper).toContain("CLERGY_PHOTO_MAX_BYTES");
    expect(helper).toContain("sharp(contents).metadata()");
    expect(helper).toContain('storage", "services", "clergy"');
    expect(photoRoute).toContain('requirePermission("MANAGE_SERVICES")');
  });

  it("keeps biography markup limited to the requested formatting", () => {
    const sanitized = sanitizeClergyBiographyHtml('<strong>Bold</strong><em>Italic</em><u>Underline</u><a href="https://example.com" onclick="bad()">Link</a><font size="5">Large</font><script>alert(1)</script><img src="bad">');
    expect(sanitized).toContain("<strong>Bold</strong>");
    expect(sanitized).toContain("<em>Italic</em>");
    expect(sanitized).toContain("<u>Underline</u>");
    expect(sanitized).toContain('<a href="https://example.com">Link</a>');
    expect(sanitized).toContain('<span style="font-size: 1.25rem">Large</span>');
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("<img");
    expect(sanitized).not.toContain("onclick");
  });

  it("supports expandable management with soft deletion", () => {
    const page = read("app/admin/services/preachers-clergy/clergy-manager.tsx");
    const route = read("app/api/services/clergy/[id]/route.ts");
    expect(page).toContain("setExpandedId");
    expect(page).toContain("ProfileDetails");
    expect(page).toContain('fetch(`/api/services/clergy/${profile.id}`, { method: "PATCH"');
    expect(page).toContain('fetch(`/api/services/clergy/${profile.id}`, { method: "DELETE"');
    expect(route).toContain('data: { status: "INACTIVE" }');
    expect(page).toContain("These name and contact values are clergy-specific overrides.");
  });

  it("prevents duplicate independent profiles and confirms immediate insertion", () => {
    const route = read("app/api/services/clergy/route.ts");
    const page = read("app/admin/services/preachers-clergy/clergy-manager.tsx");
    expect(route).toContain("duplicateWhere");
    expect(route).toContain("already exists.");
    expect(page).toContain("setProfiles((current) => [body");
    expect(page).toContain("was added to the clergy list.");
    expect(page).toContain("disabled={submitting}");
  });

  it("cleans only inactive duplicate identities during migration", () => {
    const migration = read("prisma/migrations/20261024080000_remove_duplicate_inactive_clergy_profiles/migration.sql");
    expect(migration).toContain('duplicate."status" = \'INACTIVE\'');
    expect(migration).toContain('canonical."status" = \'ACTIVE\'');
    expect(migration).toContain('canonical."churchId" = duplicate."churchId"');
    expect(migration).toContain('lower(trim(coalesce(canonical."email", \'\'))) = lower(trim(coalesce(duplicate."email", \'\')))');
  });

  it("supports deactivation followed by permanent deletion", () => {
    const route = read("app/api/services/clergy/[id]/route.ts");
    const page = read("app/admin/services/preachers-clergy/clergy-manager.tsx");
    expect(route).toContain('if (profile.status === "INACTIVE")');
    expect(route).toContain("removeClergyPhoto(profile.photographUrl)");
    expect(route).toContain("db.clergyProfile.delete");
    expect(page).toContain('profile.status === "ACTIVE" ? "Deactivate" : "Delete"');
  });

  it("removes the specifically requested inactive duplicate during deployment", () => {
    const migration = read("prisma/migrations/20261024083000_remove_alan_marxhausen_inactive_profile/migration.sql");
    expect(migration).toContain("'alan'");
    expect(migration).toContain("'marxhausen'");
    expect(migration).toContain("'INACTIVE'");
  });
});
