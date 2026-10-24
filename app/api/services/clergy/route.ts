import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { CLERGY_TITLES } from "@/lib/services-clergy";

const titleSet = new Set<string>(CLERGY_TITLES);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function status(value: unknown) {
  return value === "INACTIVE" ? "INACTIVE" : value === "ACTIVE" ? "ACTIVE" : null;
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
        select: { id: true, firstName: true, lastName: true, email: true, cellphone: true, otherPhone: true, status: true, memberNumber: true },
      });
      return NextResponse.json({ members });
    }
    const profiles = await db.clergyProfile.findMany({
      where: { churchId: user.churchId, ...(query ? { OR: [{ firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }] } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { membershipIndividual: { select: { firstName: true, lastName: true, email: true, cellphone: true, otherPhone: true, status: true, memberNumber: true } } },
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
    const input = await request.json().catch(() => ({}));
    const title = text(input?.title, 40);
    const membershipIndividualId = text(input?.membershipIndividualId, 80) || null;
    const biography = text(input?.biography, 5000) || null;
    const photographUrl = text(input?.photographUrl, 500) || null;
    const selectedStatus = status(input?.status) ?? "ACTIVE";
    if (!titleSet.has(title)) return NextResponse.json({ error: "Choose a valid clerical title." }, { status: 400 });
    if (membershipIndividualId) {
      const member = await db.membershipIndividual.findFirst({ where: { id: membershipIndividualId, churchId: user.churchId }, select: { id: true } });
      if (!member) return NextResponse.json({ error: "The selected membership individual was not found." }, { status: 400 });
      const existing = await db.clergyProfile.findUnique({ where: { membershipIndividualId }, select: { id: true } });
      if (existing) return NextResponse.json({ error: "That membership individual is already listed as clergy." }, { status: 400 });
      const profile = await db.clergyProfile.create({ data: { churchId: user.churchId, membershipIndividualId, title, biography, photographUrl, status: selectedStatus } });
      return NextResponse.json(profile, { status: 201 });
    }
    const firstName = text(input?.firstName, 80);
    const lastName = text(input?.lastName, 80);
    const email = text(input?.email, 160);
    if (!firstName || !lastName || !email) return NextResponse.json({ error: "Independent clergy records require first name, last name, and email address." }, { status: 400 });
    const profile = await db.clergyProfile.create({ data: { churchId: user.churchId, title, firstName, lastName, email, phone: text(input?.phone, 60) || null, biography, photographUrl, status: selectedStatus } });
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create clergy profile." }, { status: 400 });
  }
}
