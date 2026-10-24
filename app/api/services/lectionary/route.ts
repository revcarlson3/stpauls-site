import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

const SOURCE = "https://lectionary.collver.biz/api/calendar";
const DAY_SOURCE = "https://lectionary.collver.biz/api/day";
const FIXED_FESTIVALS = [
  [2, 2], [3, 19], [3, 25], [5, 1], [5, 31], [6, 11], [6, 24], [6, 29],
  [7, 22], [7, 25], [8, 24], [9, 14], [9, 29], [10, 23], [10, 28], [10, 31],
  [11, 1], [11, 30], [12, 21], [12, 26], [12, 27], [12, 28],
] as const;

function normalizeEvent(event: Record<string, unknown>) {
  const source = typeof event.source === "string" ? event.source : null;
  const reusablePropers = source?.includes("Common Service Book") && source.includes("1917");
  const readings = event.readings && typeof event.readings === "object" ? event.readings as Record<string, unknown> : {};
  if (Array.isArray(event.readings_parsed)) {
    for (const reading of event.readings_parsed) {
      if (!reading || typeof reading !== "object") continue;
      const item = reading as Record<string, unknown>;
      const label = typeof item.label === "string" ? item.label : "";
      const reference = typeof item.ref === "string" ? item.ref : null;
      if (label === "First Reading") readings.ot = reference;
      if (label === "Psalm") readings.ps = reference;
      if (label === "Epistle") readings.ep = reference;
      if (label === "Gospel") readings.go = reference;
    }
  }
  return {
    key: typeof event.slot === "string" ? event.slot : "",
    name: typeof event.name === "string" ? event.name : "",
    date: typeof event.date === "string" ? event.date : null,
    series: typeof event.series === "string" ? event.series : null,
    readings: {
      oldTestament: typeof readings.ot === "string" ? readings.ot : null,
      psalm: typeof readings.ps === "string" ? readings.ps : null,
      epistle: typeof readings.ep === "string" ? readings.ep : null,
      gospel: typeof readings.go === "string" ? readings.go : null,
    },
    introit: reusablePropers && event.introit && typeof event.introit === "object" ? {
      name: typeof (event.introit as Record<string, unknown>).name === "string" ? (event.introit as Record<string, string>).name : null,
      reference: typeof (event.introit as Record<string, unknown>).ref === "string" ? (event.introit as Record<string, string>).ref : null,
      text: typeof (event.introit as Record<string, unknown>).text === "string" ? (event.introit as Record<string, string>).text : null,
    } : null,
    gradual: reusablePropers && typeof event.gradual === "string" ? event.gradual : null,
    verse: reusablePropers && typeof event.verse === "string" ? event.verse : null,
    collect: reusablePropers && typeof event.collect === "string" ? event.collect : null,
    source,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    await requireTenantScope();
    const url = new URL(request.url);
    const lectionary = url.searchParams.get("lectionary") === "ONE_YEAR" ? "one_year" : "three_year";
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 1900 || year > 2300) return NextResponse.json({ error: "Choose a valid church year." }, { status: 400 });
    const response = await fetch(`${SOURCE}/${year}?lectionary=${lectionary}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "The lectionary source is temporarily unavailable." }, { status: 502 });
    const body = await response.json() as { church_year?: string; events?: Array<Record<string, unknown>> };
    const calendarEvents = Array.isArray(body.events) ? body.events.filter((event) => typeof event.date === "string" && typeof event.name === "string").map(normalizeEvent) : [];
    const festivalDates = FIXED_FESTIVALS.map(([month, day]) => {
      const festivalYear = month >= 11 ? year : year + 1;
      return `${festivalYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
    const festivalResponses = await Promise.all(festivalDates.map(async (date) => {
      try {
        const response = await fetch(`${DAY_SOURCE}/${date}?lectionary=${lectionary}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) return null;
        const event = await response.json() as Record<string, unknown>;
        return typeof event.name === "string" && typeof event.slot === "string" ? normalizeEvent(event) : null;
      } catch {
        return null;
      }
    }));
    const seen = new Set<string>();
    const events = [...calendarEvents, ...festivalResponses.filter((event): event is NonNullable<typeof event> => Boolean(event))]
      .filter((event) => {
        const identity = `${event.date}:${event.key}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
      .sort((left, right) => `${left.date}:${left.name}`.localeCompare(`${right.date}:${right.name}`));
    return NextResponse.json({ churchYear: body.church_year ?? null, events });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the lectionary." }, { status: 400 });
  }
}
