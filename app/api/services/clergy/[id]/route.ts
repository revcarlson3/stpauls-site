import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";
import { sanitizeClergyBiographyHtml } from "@/lib/clergy-biography";
import { clergyPhotoPath, prepareClergyPhoto, removeClergyPhoto } from "@/lib/clergy-photo";
import { CLERGY_TITLES } from "@/lib/services-clergy";

const titleSet = new Set<string>(CLERGY_TITLES);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    if (!user.churchId) return NextResponse.json({ error: "A church membership is required." }, { status: 400 });
    const existing = await db.clergyProfile.findFirst({ where: { id: params.id, churchId: user.churchId }, include: { membershipIndividual: { select: { id: true } } } });
    if (!existing) return NextResponse.json({ error: "Clergy profile not found." }, { status: 404 });
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const formData = isMultipart ? await request.formData() : null;
    const input = formData ? Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === "string")) : await request.json().catch(() => ({}));
    const title = text(input?.title, 40);
    const selectedStatus = input?.status === "INACTIVE" ? "INACTIVE" : input?.status === "ACTIVE" ? "ACTIVE" : null;
    if (title && !titleSet.has(title)) return NextResponse.json({ error: "Choose a valid clerical title." }, { status: 400 });
    if (input?.status && !selectedStatus) return NextResponse.json({ error: "Choose a valid clergy status." }, { status: 400 });
    const photo = formData?.get("photo");
    let uploadedPhoto: { filename: string; contents: Buffer } | null = null;
    if (photo instanceof File && photo.size) {
      try {
        uploadedPhoto = await prepareClergyPhoto(photo);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid clergy photograph." }, { status: 400 });
      }
    }
    const updated = await db.clergyProfile.update({
      where: { id: existing.id },
      data: {
        title: title || undefined,
        biography: input?.biography === undefined ? undefined : sanitizeClergyBiographyHtml(text(input.biography, 5000)) || null,
        status: selectedStatus ?? undefined,
        firstName: input?.firstName === undefined ? undefined : text(input.firstName, 80) || null,
        lastName: input?.lastName === undefined ? undefined : text(input.lastName, 80) || null,
        email: input?.email === undefined ? undefined : text(input.email, 160) || null,
        phone: input?.phone === undefined ? undefined : text(input.phone, 60) || null,
      },
    });
    if (uploadedPhoto) {
      await mkdir(path.dirname(clergyPhotoPath("photo")), { recursive: true });
      await writeFile(clergyPhotoPath(uploadedPhoto.filename), uploadedPhoto.contents);
      await removeClergyPhoto(existing.photographUrl);
      const withPhoto = await db.clergyProfile.update({ where: { id: updated.id }, data: { photographUrl: `/api/services/clergy/${updated.id}/photo?file=${encodeURIComponent(uploadedPhoto.filename)}` } });
      return NextResponse.json(withPhoto);
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update clergy profile." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    if (!user.churchId) return NextResponse.json({ error: "A church membership is required." }, { status: 400 });
    const profile = await db.clergyProfile.findFirst({ where: { id: params.id, churchId: user.churchId }, select: { id: true, status: true, photographUrl: true } });
    if (!profile) return NextResponse.json({ error: "Clergy profile not found." }, { status: 404 });
    if (profile.status === "INACTIVE") {
      await removeClergyPhoto(profile.photographUrl);
      await db.clergyProfile.delete({ where: { id: profile.id } });
      return NextResponse.json({ deleted: true });
    }
    const updated = await db.clergyProfile.update({ where: { id: profile.id }, data: { status: "INACTIVE" } });
    return NextResponse.json({ ...updated, deactivated: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to inactivate clergy profile." }, { status: 400 });
  }
}
