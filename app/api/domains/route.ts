import { NextResponse } from "next/server";
import { createTenantDomain, listTenantDomains } from "@/lib/domain-provider";

export async function GET() {
  try {
    return NextResponse.json({ domains: await listTenantDomains() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load domains." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    if (typeof input.hostname !== "string" || !["PLATFORM_SUBDOMAIN", "CUSTOM_DOMAIN"].includes(input.kind)) return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
    return NextResponse.json({ domain: await createTenantDomain({ hostname: input.hostname, kind: input.kind }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add domain." }, { status: 400 });
  }
}
