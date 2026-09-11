import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
}

export async function GET() {
  try {
    await authorize();
    const types = await db.membershipMemberType.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, position: true, _count: { select: { individuals: true } } }
    });
    return NextResponse.json({ types });
  } catch {
    return NextResponse.json({ error: "Unable to load member types." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!name || name.length > 80 || !slug) return NextResponse.json({ error: "Enter a valid member type name." }, { status: 400 });
    const last = await db.membershipMemberType.aggregate({ _max: { position: true } });
    const type = await db.membershipMemberType.create({ data: { name, slug, position: (last._max.position ?? -1) + 1 }, select: { id: true, name: true, slug: true, position: true, _count: { select: { individuals: true } } } });
    return NextResponse.json({ type }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to add member type. A type with that name may already exist." }, { status: 400 });
  }

}

export async function PATCH(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const ids: string[] = Array.isArray(input?.ids) ? input.ids.filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim())).map((id: string) => id.trim()) : [];
    if (!ids.length || new Set(ids).size !== ids.length) return NextResponse.json({ error: "A unique member type order is required." }, { status: 400 });
    const existing = await db.membershipMemberType.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (existing.length !== ids.length) return NextResponse.json({ error: "The member type list is out of date. Reload and try again." }, { status: 409 });
    await db.$transaction(ids.map((id: string, position: number) => db.membershipMemberType.update({ where: { id }, data: { position } })));
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Unable to save member type order." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await authorize();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Member type is required." }, { status: 400 });
    const type = await db.membershipMemberType.findUnique({ where: { id }, select: { _count: { select: { individuals: true } } } });
    if (!type) return NextResponse.json({ error: "Member type not found." }, { status: 404 });
    if (type._count.individuals > 0) return NextResponse.json({ error: "This member type is in use and cannot be removed. Reassign those members first." }, { status: 409 });
    await db.membershipMemberType.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove member type." }, { status: 400 });
  }
}
