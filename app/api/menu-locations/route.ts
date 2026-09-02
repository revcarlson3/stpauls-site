import { NextResponse } from "next/server";
import { createMenuLocation, listMenuLocations } from "@/lib/content";

export async function GET() {
  try {
    return NextResponse.json(await listMenuLocations());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { name?: unknown; slug?: unknown } | null;
  if (!input || typeof input.name !== "string" || typeof input.slug !== "string" || !input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) return NextResponse.json({ error: "Invalid location input." }, { status: 400 });
  try {
    return NextResponse.json(await createMenuLocation({ name: input.name.trim(), slug: input.slug }), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
