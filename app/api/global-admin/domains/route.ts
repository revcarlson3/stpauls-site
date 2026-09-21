import { NextResponse } from "next/server";
import { addSelectedChurchDomain, listSelectedChurchDomains } from "@/lib/global-admin-domains";

export async function GET() {
  try {
    return NextResponse.json({ domains: await listSelectedChurchDomains() });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to load domains." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({ domain: await addSelectedChurchDomain({ hostname: input.hostname, kind: input.kind }) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && (error.message.startsWith("Unauthorized:") || error.message === "Selected site lifecycle does not allow this change.")) return NextResponse.json({ error: error.message.startsWith("Unauthorized:") ? "Bridge access is required." : error.message }, { status: 403 });
    if (error instanceof Error && (error.message.startsWith("Provide") || error.message.includes("already registered"))) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to add domain." }, { status: 500 });
  }
}
