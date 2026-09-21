import { NextResponse } from "next/server";
import { createGlobalAnnouncement, listGlobalAnnouncements } from "@/lib/global-admin-announcements";

export async function GET() {
  try {
    return NextResponse.json({ announcements: await listGlobalAnnouncements() });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load announcements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    return NextResponse.json({ announcement: await createGlobalAnnouncement(input) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && (error.message.includes("required") || error.message.includes("tenant") || error.message.startsWith("Invalid") || error.message.startsWith("The end"))) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to create announcement." }, { status: 500 });
  }
}
