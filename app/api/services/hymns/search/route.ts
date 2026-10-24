import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
    if (query.length < 2) return NextResponse.json({ results: [] });
    const searchUrl = `https://hymnary.org/search?qu=${encodeURIComponent(query)}`;
    const response = await fetch(`${searchUrl}&export=csv`, { headers: { Accept: "text/csv" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ results: [], sourceUrl: searchUrl });
    const csv = await response.text();
    const lines = csv.split(/\r?\n/).filter(Boolean).slice(0, 21);
    const results = lines.slice(1).map((line) => {
      const columns = line.split(",").map((value) => value.replace(/^"|"$/g, "").replace(/""/g, '"'));
      return { number: columns[0] || "", title: columns[1] || columns[0] || query, sourceUrl: searchUrl };
    }).filter((result) => result.title);
    return NextResponse.json({ results, sourceUrl: searchUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search Hymnary.org." }, { status: 400 });
  }
}
