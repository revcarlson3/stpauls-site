import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

describe("services and sermons module navigation", () => {
  it("exposes all initial module pages in the admin navigation", () => {
    const source = fs.readFileSync(path.join(root, "components/module-navigation.tsx"), "utf8");
    expect(source).toContain('href="/admin/services/sermons"');
    expect(source).toContain('href="/admin/services/services"');
    expect(source).toContain('href="/admin/services/preachers-clergy"');
    expect(source).toContain('href="/admin/services/streaming"');
    expect(source).toContain('href="/admin/services/settings"');
  });

  it("defines each protected initial module route", () => {
    for (const route of ["sermons", "services", "preachers-clergy", "streaming", "settings"]) {
      const source = fs.readFileSync(path.join(root, "app", "admin", "services", route, "page.tsx"), "utf8");
      expect(source).toContain('requirePermission("MANAGE_SERVICES")');
      expect(source).toContain('requireEnabledModule("services"');
    }
  });
});

describe("admin settings navigation", () => {
  it("keeps report automations outside the module navigation and distinguishes billing", () => {
    const source = fs.readFileSync(path.join(root, "components/admin-navigation.tsx"), "utf8");
    const icons = fs.readFileSync(path.join(root, "components/admin-nav-icon.tsx"), "utf8");
    expect(source).toContain(">Report Settings");
    expect(source).toContain('href="/admin/report-automations"');
    expect(source).toContain('<AdminNavIcon name="reports" />');
    expect(source).toContain('<AdminNavIcon name="billing" />Billing and Domains');
    expect(icons).toContain('type AdminNavIconName =');
    expect(icons).toContain('"billing"');
    expect(icons).toContain('"reports"');
  });
});
