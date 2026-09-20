import { NextResponse } from "next/server";
import { deleteGlobalAnnouncement, updateGlobalAnnouncement } from "@/lib/global-admin-announcements";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ announcement: await updateGlobalAnnouncement(params.id, await request.json()) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && (error.message.includes("required") || error.message.includes("tenant") || error.message.startsWith("Invalid") || error.message.startsWith("The end"))) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update announcement." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ announcement: await deleteGlobalAnnouncement(params.id) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    return NextResponse.json({ error: "Unable to delete announcement." }, { status: 500 });
  }
}
