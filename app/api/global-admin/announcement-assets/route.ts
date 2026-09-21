import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { globalAnnouncementImageMimeTypes, readGlobalAnnouncementImage, saveGlobalAnnouncementImage } from "@/lib/global-announcement-assets";

export async function POST(request: Request) {
  try {
    await requireGlobalAdmin({ sensitive: true });
    const file = (await request.formData()).get("asset");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    return NextResponse.json({ asset: await saveGlobalAnnouncementImage(file) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Global administrator access is required." }, { status: 403 });
    if (error instanceof Error && error.message.startsWith("Choose")) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to upload announcement image." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  try {
    const filename = new URL(request.url).searchParams.get("file") ?? "";
    const file = await readGlobalAnnouncementImage(filename);
    const extension = filename.split(".").pop() as keyof typeof globalAnnouncementImageMimeTypes;
    return new Response(new Uint8Array(file), { headers: { "Content-Type": globalAnnouncementImageMimeTypes[extension], "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "Announcement image not found." }, { status: 404 });
  }
}
