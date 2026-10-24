import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { CLERGY_TITLES } from "@/lib/services-clergy";
import { sanitizeClergyBiographyHtml } from "@/lib/clergy-biography";
import { mkdir, writeFile } from "fs/promises";
import { clergyPhotoPath, prepareClergyPhoto } from "@/lib/clergy-photo";
import path from "path";

const titleSet = new Set<string>(CLERGY_TITLES);
const profileInclude = {
  membershipIndividual: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      cellphone: true,
      otherPhone: true,
      status: true,
      memberNumber: true,
      family: { select: { photographUrl: true } },
    },
  },
} as const;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function status(value: unknown) {
  return value === "INACTIVE" ? "INACTIVE" : value === "ACTIVE" ? "ACTIVE" : null;
}

function duplicateWhere(churchId: string, firstName: string, lastName: string, email: string) {
  return {
    churchId,
    firstName: { equals: firstName, mode: "insensitive" as const },
    lastName: { equals: lastName, mode: "insensitive" as const },
    email: { equals: email, mode: "insensitive" as const },
  };
}

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    if (!user.churchId) return NextResponse.json({ error: "A church membership is required." }, { status: 400 });
    const url = new URL(request.url);
    const membersOnly = url.searchParams.get("members") === "true";
    const query = text(url.searchParams.get("q"), 80);
    if (membersOnly) {
      const members = await db.membershipIndividual.findMany({
        where: {
          churchId: user.churchId,
          status: { in: ["ACTIVE", "INACTIVE"] },
          ...(query ? { OR: [{ firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {}),
          clergyProfile: null,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 100,
        select: { id: true, firstName: true, lastName: true, email: true, cellphone: true, otherPhone: true, status: true, memberNumber: true, family: { select: { photographUrl: true } } },
      });
      return NextResponse.json({ members });
    }
    const profiles = await db.clergyProfile.findMany({
      where: { churchId: user.churchId, ...(query ? { OR: [{ firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }] } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: profileInclude,
    });
    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load clergy profiles." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_SERVICES");
    await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
    if (!user.churchId) return NextResponse.json({ error: "A church membership is required." }, { status: 400 });
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const formData = isMultipart ? await request.formData() : null;
    const input = formData ? Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === "string")) : await request.json().catch(() => ({}));
    const photo = formData?.get("photo");
    const title = text(input?.title, 40);
    const membershipIndividualId = text(input?.membershipIndividualId, 80) || null;
    const biography = sanitizeClergyBiographyHtml(text(input?.biography, 5000)) || null;
    if (photo && (!(photo instanceof File) || !photo.size)) return NextResponse.json({ error: "Choose a photograph to upload." }, { status: 400 });
    let uploadedPhoto: { filename: string; contents: Buffer } | null = null;
    if (photo instanceof File) {
      try {
        uploadedPhoto = await prepareClergyPhoto(photo);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid clergy photograph." }, { status: 400 });
      }
    }
    const photographUrl = uploadedPhoto ? null : text(input?.photographUrl, 500) || null;
    const selectedStatus = status(input?.status) ?? "ACTIVE";
    if (!titleSet.has(title)) return NextResponse.json({ error: "Choose a valid clerical title." }, { status: 400 });
    if (membershipIndividualId) {
      const member = await db.membershipIndividual.findFirst({ where: { id: membershipIndividualId, churchId: user.churchId }, select: { id: true } });
      if (!member) return NextResponse.json({ error: "The selected membership individual was not found." }, { status: 400 });
      const existing = await db.clergyProfile.findUnique({ where: { membershipIndividualId }, select: { id: true } });
      if (existing) return NextResponse.json({ error: "That membership individual is already listed as clergy." }, { status: 400 });
      const profile = await db.clergyProfile.create({ data: { churchId: user.churchId, membershipIndividualId, title, biography, photographUrl, status: selectedStatus }, include: profileInclude });
      if (uploadedPhoto) {
        await mkdir(path.dirname(clergyPhotoPath("photo")), { recursive: true });
        await writeFile(clergyPhotoPath(uploadedPhoto.filename), uploadedPhoto.contents);
        const updated = await db.clergyProfile.update({ where: { id: profile.id }, data: { photographUrl: `/api/services/clergy/${profile.id}/photo?file=${encodeURIComponent(uploadedPhoto.filename)}` }, include: profileInclude });
        return NextResponse.json(updated, { status: 201 });
      }
      return NextResponse.json(profile, { status: 201 });
    }
    const firstName = text(input?.firstName, 80);
    const lastName = text(input?.lastName, 80);
    const email = text(input?.email, 160).toLowerCase();
    if (!firstName || !lastName || !email) return NextResponse.json({ error: "Independent clergy records require first name, last name, and email address." }, { status: 400 });
    const duplicate = await db.clergyProfile.findFirst({ where: duplicateWhere(user.churchId, firstName, lastName, email), select: { id: true, status: true } });
    if (duplicate) return NextResponse.json({ error: "A clergy profile with this name and email already exists.", profileId: duplicate.id, status: duplicate.status }, { status: 409 });
    const profile = await db.clergyProfile.create({ data: { churchId: user.churchId, title, firstName, lastName, email, phone: text(input?.phone, 60) || null, biography, photographUrl, status: selectedStatus }, include: profileInclude });
    if (uploadedPhoto) {
      await mkdir(path.dirname(clergyPhotoPath("photo")), { recursive: true });
      await writeFile(clergyPhotoPath(uploadedPhoto.filename), uploadedPhoto.contents);
      const updated = await db.clergyProfile.update({ where: { id: profile.id }, data: { photographUrl: `/api/services/clergy/${profile.id}/photo?file=${encodeURIComponent(uploadedPhoto.filename)}` }, include: profileInclude });
      return NextResponse.json(updated, { status: 201 });
    }
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create clergy profile." }, { status: 400 });
  }
}
