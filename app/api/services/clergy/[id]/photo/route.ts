import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { clergyPhotoPath } from "@/lib/clergy-photo";
import { requireEnabledModule } from "@/lib/modules";
import path from "path";

const mimeTypes = new Map([["jpg", "image/jpeg"], ["png", "image/png"]]);

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    const profile = await db.clergyProfile.findUnique({
      where: { id: params.id },
      select: { churchId: true, photographUrl: true, membershipIndividual: { select: { family: { select: { photographUrl: true } } } } },
    });
    if (!profile || user.churchId !== profile.churchId) return NextResponse.json({ error: "Clergy photograph not found." }, { status: 404 });
    const requested = new URL(request.url).searchParams.get("file");
    const membershipPhoto = profile.membershipIndividual?.family.photographUrl;
    const customPhotoMatches = Boolean(profile.photographUrl && requested && profile.photographUrl === `/api/services/clergy/${params.id}/photo?file=${encodeURIComponent(requested)}`);
    const membershipPhotoMatches = Boolean(!profile.photographUrl && membershipPhoto && requested && membershipPhoto.includes(`file=${encodeURIComponent(requested)}`));
    if (!requested || (!customPhotoMatches && !membershipPhotoMatches) || !/^[a-zA-Z0-9-]+\.(jpg|png|jpeg|webp)$/.test(requested)) {
      return NextResponse.json({ error: "Clergy photograph not found." }, { status: 404 });
    }
    const filePath = customPhotoMatches
      ? clergyPhotoPath(requested)
      : membershipPhoto?.startsWith("/uploads/membership/")
        ? path.join(process.cwd(), "public", membershipPhoto)
        : path.join(process.cwd(), "storage", "membership", requested);
    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": mimeTypes.get(requested.split(".").pop()?.toLowerCase() ?? "") ?? `image/${requested.split(".").pop()?.toLowerCase()}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load clergy photograph." }, { status: 404 });
  }
}
