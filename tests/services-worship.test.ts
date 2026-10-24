import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS, LSB_LITURGIES } from "@/lib/worship-service";
import { parseHymnalHymns, parseHymnalList } from "@/lib/hymnary";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("worship services", () => {
  it("defines the initial LSB liturgy settings and Bible book choices", () => {
    expect(LSB_LITURGIES.length).toBeGreaterThan(5);
    expect(LSB_LITURGIES[0]).toBe("Divine Service, Setting One");
    expect(LSB_LITURGIES).toContain("Matins");
    expect(LSB_LITURGIES).toContain("Compline");
    expect(LSB_LITURGIES).toContain("Responsive Prayer I");
    expect(LSB_LITURGIES).toContain("Holy Baptism");
    expect(LSB_LITURGIES).toContain("Funeral Service");
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
    const hymnRoute = read("app/api/services/hymns/route.ts");
    const serviceApi = read("app/api/services/services/route.ts");
    const hymnalApi = read("app/api/services/hymnals/route.ts");
    const settingsPage = read("app/admin/services/settings/hymnal-settings.tsx");
    expect(page).toContain("Assigned preacher or clergy");
    expect(page).toContain("Scripture lessons");
    expect(page).toContain("Search saved hymnal");
    expect(page).toContain("Custom hymn");
    expect(page).toContain("Create an event on the shared Events calendar");
    expect(assetRoute).toContain('storage", "services", "worship"');
    expect(hymnRoute).toContain("primaryHymnalId");
    expect(serviceApi).toContain("selectedHymnIds");
    expect(serviceApi).toContain("not in the primary hymnal");
    expect(serviceApi).toContain("custom: true");
    expect(hymnalApi).toContain("worshipHymnal.deleteMany");
    expect(hymnalApi).toContain("worshipServiceSettings.upsert");
    expect(settingsPage).toContain("Import hymnal");
  });

  it("parses hymnal and hymn metadata without importing copyrighted content", () => {
    const hymnalHtml = '<a href="/hymnal/LSB2006">Lutheran Service Book</a>';
    const hymnHtml = '<tr><td><a href="/hymn/LSB2006/151">151</a></td><td><a href="/hymn/LSB2006/151">A Mighty Fortress</a></td><td><a href="/tune/EIN_FESTE_BURG">EIN FESTE BURG</a></td></tr>';
    expect(parseHymnalList(hymnalHtml)[0]).toMatchObject({ code: "LSB2006", name: "Lutheran Service Book" });
    expect(parseHymnalHymns(hymnHtml, "LSB2006")[0]).toMatchObject({ number: "151", title: "A Mighty Fortress", tuneName: "EIN FESTE BURG", copyrightInfo: null });
  });
});
