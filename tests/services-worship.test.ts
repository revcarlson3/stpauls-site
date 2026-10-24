import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS, LSB_LITURGIES } from "@/lib/worship-service";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("worship services", () => {
  it("defines the initial LSB liturgy settings and Bible book choices", () => {
    expect(LSB_LITURGIES).toHaveLength(5);
    expect(LSB_LITURGIES[0]).toBe("Divine Service, Setting One");
    expect(BIBLE_BOOKS).toContain("John");
    expect(BIBLE_BOOKS).toContain("1 Corinthians");
  });

  it("keeps worship service data tenant-scoped and linked to shared event data", () => {
    const schema = read("prisma/schema.prisma");
    const route = read("app/api/services/services/route.ts");
    expect(schema).toContain("model WorshipService");
    expect(schema).toContain("eventId");
    expect(schema).toContain("@unique");
    expect(schema).toContain("model WorshipServiceClergy");
    expect(schema).toContain("model WorshipServiceLesson");
    expect(route).toContain('requirePermission("MANAGE_SERVICES")');
    expect(route).toContain('requireEnabledModule("services"');
    expect(route).toContain("membershipEvent.create");
    expect(route).toContain("eventTypes");
    expect(route).toContain("featuredImageUrl");
    expect(route).toContain("bulletinUrl");
  });

  it("provides the service creation UI and isolated asset route", () => {
    const page = read("app/admin/services/services/services-manager.tsx");
    const assetRoute = read("app/api/services/services/assets/[filename]/route.ts");
    const hymnRoute = read("app/api/services/hymns/search/route.ts");
    expect(page).toContain("Assigned preacher or clergy");
    expect(page).toContain("Scripture lessons");
    expect(page).toContain("Search Hymnary");
    expect(page).toContain("Create an event on the shared Events calendar");
    expect(assetRoute).toContain('storage", "services", "worship"');
    expect(hymnRoute).toContain("hymnary.org/search");
  });
});
