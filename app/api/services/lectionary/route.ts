import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

const SOURCE = "https://lectionary.collver.biz/api/calendar";

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
    const events = Array.isArray(body.events) ? body.events.filter((event) => typeof event.date === "string" && typeof event.name === "string").map((event) => {
      const source = typeof event.source === "string" ? event.source : null;
      const reusablePropers = source?.includes("Common Service Book") && source.includes("1917");
      return {
        key: typeof event.slot === "string" ? event.slot : "",
        name: typeof event.name === "string" ? event.name : "",
        date: typeof event.date === "string" ? event.date : null,
        series: typeof event.series === "string" ? event.series : null,
        readings: {
          oldTestament: typeof (event.readings as Record<string, unknown> | undefined)?.ot === "string" ? (event.readings as Record<string, string>).ot : null,
          psalm: typeof (event.readings as Record<string, unknown> | undefined)?.ps === "string" ? (event.readings as Record<string, string>).ps : null,
          epistle: typeof (event.readings as Record<string, unknown> | undefined)?.ep === "string" ? (event.readings as Record<string, string>).ep : null,
          gospel: typeof (event.readings as Record<string, unknown> | undefined)?.go === "string" ? (event.readings as Record<string, string>).go : null,
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
    }) : [];
    return NextResponse.json({ churchYear: body.church_year ?? null, events });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the lectionary." }, { status: 400 });
  }
}
