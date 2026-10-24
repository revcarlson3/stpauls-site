import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BIBLE_BOOKS, churchYearStartYear, LSB_LITURGIES } from "@/lib/worship-service";
import { fetchPublicHymnContent, importHymnal, parseHymnalCsv, parseHymnalHymns, parseHymnalList } from "@/lib/hymnary";
import { GET as getLectionary } from "@/app/api/services/lectionary/route";

vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/lib/modules", () => ({ requireEnabledModule: vi.fn(async () => undefined) }));
vi.mock("@/lib/tenant", () => ({ requireTenantScope: vi.fn(async () => ({ churchId: "church-1" })) }));

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
afterEach(() => vi.unstubAllGlobals());

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
    expect(churchYearStartYear(new Date("2026-10-24T12:00:00Z"))).toBe(2025);
    expect(churchYearStartYear(new Date("2026-12-01T12:00:00Z"))).toBe(2026);
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
    const schema = read("prisma/schema.prisma");
    const page = read("app/admin/services/services/services-manager.tsx");
    const assetRoute = read("app/api/services/services/assets/[filename]/route.ts");
    const hymnRoute = read("app/api/services/hymns/route.ts");
    const serviceApi = read("app/api/services/services/route.ts");
    const hymnalApi = read("app/api/services/hymnals/route.ts");
    const settingsApi = read("app/api/services/settings/route.ts");
    const lectionaryApi = read("app/api/services/lectionary/route.ts");
    const settingsPage = read("app/admin/services/settings/hymnal-settings.tsx");
    expect(page).toContain("Assigned preacher or clergy");
    expect(page).toContain("Pericopes");
    expect(page).toContain("Search saved hymnal");
    expect(page).toContain("Custom hymn");
    expect(page).toContain("Create an event on the shared Events calendar");
    expect(assetRoute).toContain('storage", "services", "worship"');
    expect(hymnRoute).toContain("primaryHymnalId");
    expect(serviceApi).toContain("selectedHymnIds");
    expect(serviceApi).toContain("not in the primary hymnal");
    expect(serviceApi).toContain("custom: true");
    expect(serviceApi).toContain("Service name is required.");
    expect(serviceApi).toContain("The selected church-year pericope is invalid");
    expect(serviceApi).toContain("Check the manual pericope entries");
    expect(page).toContain('role="alert"');
    expect(page).toContain('role="progressbar"');
    expect(page).toContain("xhr.upload");
    expect(hymnalApi).toContain("worshipHymnal.deleteMany");
    expect(hymnalApi).toContain("worshipServiceSettings.upsert");
    expect(settingsPage).toContain("Import hymnal");
    expect(settingsPage).toContain("LSB Three-Year");
    expect(settingsPage).toContain("Enable lectionary");
    expect(serviceApi).toContain("validatePericopes");
    expect(settingsApi).toContain("lectionaryEnabled");
    expect(lectionaryApi).toContain("lectionary.collver.biz/api/calendar");
    expect(lectionaryApi).toContain("lectionary.collver.biz/api/day");
    expect(lectionaryApi).toContain("[10, 31]");
    expect(lectionaryApi).toContain("[11, 1]");
    expect(lectionaryApi).toContain("readings_parsed");
    expect(lectionaryApi).toContain("const identity = `${event.date}:${event.key}`");
    expect(lectionaryApi).toContain("lectionaryType");
    expect(lectionaryApi).toContain("Common Service Book");
    expect(lectionaryApi).toContain('typeof event.date === "string"');
    expect(schema).toContain("pericopes");
    expect(schema).toContain("lectionaryType");
    const importer = read("lib/hymnary.ts");
    expect(importer).toContain("/instances?qu=hymnalNumber");
    expect(importer).toContain("export=csv");
    expect(importer).toContain("No partial 100-hymn import");
  });

  it("gates public hymn words and music behind explicit rights", () => {
    const schema = read("prisma/schema.prisma");
    const rightsRoute = read("app/api/services/hymns/[id]/route.ts");
    const settingsPage = read("app/admin/services/settings/hymnal-settings.tsx");
    const publicPage = read("app/(public)/services/page.tsx");
    expect(schema).toContain('lyricsRights  String              @default("UNKNOWN")');
    expect(schema).toContain('musicRights   String              @default("UNKNOWN")');
    expect(schema).toContain("arrangementRights");
    expect(schema).toContain("lyricsText");
    expect(schema).toContain("musicImageUrl");
    expect(rightsRoute).toContain('requirePermission("MANAGE_SERVICES")');
    expect(rightsRoute).toContain("PUBLIC_DOMAIN");
    expect(settingsPage).toContain("Public-domain hymn content");
    expect(publicPage).toContain('hymn.lyricsRights === "PUBLIC_DOMAIN"');
    expect(publicPage).toContain('hymn.arrangementRights === "PUBLIC_DOMAIN"');
    expect(publicPage).toContain("Words and music are not available for public display.");
    expect(rightsRoute).toContain("fetchPublicHymnContent");
    expect(settingsPage).toContain("Checking Hymnary for verified public-domain content");
  });

  it("adds weekday festivals and keeps same-date Sunday and festival choices", async () => {
    const ordinary = {
      slot: "ordinary-22-pentecost",
      name: "Twenty-second Sunday after Pentecost",
      date: "2026-10-31",
      readings: { ot: "Isaiah 1:10-18", ps: "Psalm 32", ep: "Philippians 1:1-11", go: "Matthew 18:21-35" },
    };
    const reformation = {
      slot: "reformation",
      name: "Reformation Day",
      date: "2026-10-31",
      source: "Common Service Book of the Lutheran Church (Philadelphia, 1917)",
      introit: { name: "Dominus Fortitudo Plebis", ref: "Psalm 46:7, 4; Psalm 46:1", text: "The Lord of Hosts is with us." },
      gradual: "Great is the Lord.",
      collect: "O Lord God, Heavenly Father.",
      readings_parsed: [
        { label: "First Reading", ref: "Revelation 14:6-7" },
        { label: "Psalm", ref: "Psalm 46" },
        { label: "Epistle", ref: "Romans 3:19-28" },
        { label: "Gospel", ref: "John 8:31-36" },
      ],
    };
    const allSaints = {
      slot: "all_saints",
      name: "All Saints' Day",
      date: "2025-11-01",
      readings_parsed: [{ label: "Gospel", ref: "Matthew 5:1-12" }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (input.includes("/calendar/2025?")) return Response.json({ church_year: "2025–2026", events: [ordinary] });
      if (input.includes("2026-10-31")) return Response.json(reformation);
      if (input.includes("2025-11-01")) return Response.json(allSaints);
      return new Response(null, { status: 404 });
    }));

    const response = await getLectionary(new Request("http://localhost/api/services/lectionary?lectionary=THREE_YEAR&year=2025"));
    const body = await response.json() as { events: Array<{ key: string; name: string; date: string; readings: { gospel: string | null } }> };
    const sameDate = body.events.filter((event) => event.date === "2026-10-31");
    expect(sameDate.map((event) => event.key)).toEqual(expect.arrayContaining(["ordinary-22-pentecost", "reformation"]));
    expect(body.events.find((event) => event.key === "all_saints")).toMatchObject({ name: "All Saints' Day", date: "2025-11-01" });
    expect(body.events.find((event) => event.key === "reformation")?.readings.gospel).toBe("John 8:31-36");
    expect(body.events.find((event) => event.key === "reformation")).toMatchObject({ lectionary: "THREE_YEAR" });
    expect(body.events.find((event) => event.key === "reformation")).toMatchObject({ gradual: "Great is the Lord.", collect: "O Lord God, Heavenly Father." });
  });

  it("hydrates only Hymnary resources explicitly marked public domain", async () => {
    const hymnPage = '<a href="/text/public-hymn">Text</a>';
    const textPage = '<div id="at_fulltext"><div property="text"><p>Verse one<br>Verse two</p></div><div class="authority_bottom_bar"></div></div><div id="textinfo"><table><tr><td>Copyright:</td><td><span class="hy_infoItem">Public Domain</span></td></tr></table></div><img data-img-src="/page/fetch/HOoS1926/222/thumbnail">';
    const fetchMock = vi.fn(async (input: string) => new Response(input.endsWith("/text/public-hymn") ? textPage : hymnPage, { headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPublicHymnContent("https://hymnary.org/hymn/PD/1")).resolves.toMatchObject({ lyricsText: "Verse one\nVerse two", lyricsRights: "PUBLIC_DOMAIN", musicRights: "PUBLIC_DOMAIN", arrangementRights: "PUBLIC_DOMAIN", musicImageUrl: "https://hymnary.org/page/fetch/HOoS1926/222/low" });
  });

  it("parses hymnal and hymn metadata without importing copyrighted content", () => {
    const hymnalHtml = '<a href="/hymnal/LSB2006">Lutheran Service Book</a>';
    const hymnHtml = '<tr><td><a href="/hymn/LSB2006/151">151</a></td><td><a href="/hymn/LSB2006/151">A Mighty Fortress</a></td><td><a href="/tune/EIN_FESTE_BURG">EIN FESTE BURG</a></td></tr>';
    expect(parseHymnalList(hymnalHtml)[0]).toMatchObject({ code: "LSB2006", name: "Lutheran Service Book" });
    expect(parseHymnalHymns(hymnHtml, "LSB2006")[0]).toMatchObject({ number: "151", title: "A Mighty Fortress", tuneName: "EIN FESTE BURG", copyrightInfo: null });
    expect(parseHymnalCsv('number,title,first line,tune\n151,"A Mighty Fortress","A mighty fortress is our God","EIN FESTE BURG"', "LSB2006")[0]).toMatchObject({ number: "151", title: "A Mighty Fortress", firstLine: "A mighty fortress is our God", tuneName: "EIN FESTE BURG" });
    expect(parseHymnalCsv('firstLine,displayTitle,textAuthNumber,hymnalTitle,hymnalID,number,textTitle,refrainFirstLine,authors,composers,meter,tuneTitle\n"A mighty fortress is our God","A Mighty Fortress",, "Lutheran Service Book",LSB2006,656,"A Mighty Fortress",,"Martin Luther",,"8.7.8.7.5.5.5.6.7","EIN FESTE BURG"', "LSB2006")[0]).toMatchObject({ number: "656", title: "A Mighty Fortress", firstLine: "A mighty fortress is our God", tuneName: "EIN FESTE BURG", textAuthors: "Martin Luther" });
  });

  it("imports the complete CSV catalog instead of accepting a page-sized result", async () => {
    const firstPage = ["number,title", ...Array.from({ length: 100 }, (_, index) => `${index + 1},Hymn ${index + 1}`)].join("\n");
    const secondPage = ["number,title", ...Array.from({ length: 25 }, (_, index) => `${index + 101},Hymn ${index + 101}`)].join("\n");
    const fetchMock = vi.fn(async (input: string) => new Response(new URL(input).searchParams.get("page") === "1" ? secondPage : new URL(input).searchParams.get("page") === "2" ? "" : firstPage, { headers: { "content-type": "text/csv" } }));
    vi.stubGlobal("fetch", fetchMock);
    const imported = await importHymnal("LSB2006", "Lutheran Service Book");
    expect(imported.hymns).toHaveLength(125);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/instances?qu=hymnalNumber%3Alsb2006"), expect.objectContaining({ headers: expect.objectContaining({ Accept: "text/csv" }) }));
  });
});
