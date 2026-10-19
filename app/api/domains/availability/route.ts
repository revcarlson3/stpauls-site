import { NextResponse } from "next/server";
import { searchDomainAvailability } from "@/lib/domain-provider";

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    if (!Array.isArray(input.domains) || input.domains.some((domain: unknown) => typeof domain !== "string")) return NextResponse.json({ error: "Provide a domain list." }, { status: 400 });
    return NextResponse.json({ results: await searchDomainAvailability(input.domains) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search availability." }, { status: 400 });
  }
}
