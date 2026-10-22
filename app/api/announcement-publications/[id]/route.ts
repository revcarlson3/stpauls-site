import { NextResponse } from "next/server";
import { deletePublication, duplicatePublication, setPublicationStatus, updatePublication, type AnnouncementPublicationStatus } from "@/lib/announcement-publications";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "duplicate") return NextResponse.json({ publication: await duplicatePublication(params.id) });
    if (input.action === "status" && typeof input.status === "string" && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(input.status)) {
      return NextResponse.json({ publication: await setPublicationStatus(params.id, input.status as AnnouncementPublicationStatus) });
    }
    return NextResponse.json({ publication: await updatePublication(params.id, input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update publication." }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deletePublication(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete publication." }, { status: 400 });
  }
}
