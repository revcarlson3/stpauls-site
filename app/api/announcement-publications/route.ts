import { NextResponse } from "next/server";
import { createPublication, listTenantPublications } from "@/lib/announcement-publications";

export async function GET() {
  try {
    return NextResponse.json(await listTenantPublications());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load publications." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ publication: await createPublication(await request.json()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create publication." }, { status: 400 });
  }
}
