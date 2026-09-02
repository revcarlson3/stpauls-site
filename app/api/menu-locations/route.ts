import { NextResponse } from "next/server";
import { listMenuLocations } from "@/lib/content";

export async function GET() {
  try {
    return NextResponse.json(await listMenuLocations());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
