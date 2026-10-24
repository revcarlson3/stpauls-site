import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
    expect(route).toContain("membershipIndividual: { select:");
    expect(route).toContain("Independent clergy records require first name, last name, and email address.");
  });

  it("exposes both membership-linked and independent creation paths in the admin form", () => {
    const page = read("app/admin/services/preachers-clergy/clergy-manager.tsx");
    expect(page).toContain('setMode("member")');
    expect(page).toContain('setMode("independent")');
    expect(page).toContain('name="membershipIndividualId"');
    expect(page).toContain('name="biography"');
    expect(page).toContain('name="photographUrl"');
  });
});
