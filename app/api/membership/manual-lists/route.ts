import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { audienceSlug } from "@/lib/membership-audiences";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
}

export async function GET() {
  try {
    await authorize();
    const lists = await db.membershipManualList.findMany({ orderBy: [{ name: "asc" }], select: { id: true, name: true, description: true, slug: true, _count: { select: { members: true } } } });
    return NextResponse.json({ lists });
  } catch {
    return NextResponse.json({ error: "Unable to load manual lists." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof input?.description === "string" ? input.description.trim().slice(0, 500) : null;
    if (!name || name.length > 100) return NextResponse.json({ error: "Enter a manual list name." }, { status: 400 });
    const copyOfId = typeof input?.copyOfId === "string" ? input.copyOfId.trim() : "";
    const source = copyOfId ? await db.membershipManualList.findUnique({ where: { id: copyOfId }, select: { members: { select: { individualId: true } } } }) : null;
    if (copyOfId && !source) return NextResponse.json({ error: "Manual list to duplicate was not found." }, { status: 404 });
    const list = await db.membershipManualList.create({ data: { name, description, slug: `${audienceSlug(name)}-${Date.now().toString(36)}`, ...(source ? { members: { create: source.members.map(({ individualId }) => ({ individualId })) } } : {}) }, select: { id: true, name: true, description: true, slug: true, _count: { select: { members: true } } } });
    return NextResponse.json({ list }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create manual list." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const id = typeof input?.id === "string" ? input.id.trim() : "";
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof input?.description === "string" ? input.description.trim().slice(0, 500) : undefined;
    if (!id || !name || name.length > 100) return NextResponse.json({ error: "List and name are required." }, { status: 400 });
    const list = await db.membershipManualList.update({ where: { id }, data: { name, ...(description !== undefined ? { description: description || null } : {}) }, select: { id: true, name: true, description: true, slug: true, _count: { select: { members: true } } } });
    return NextResponse.json({ list });
  } catch {
    return NextResponse.json({ error: "Unable to save manual list." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await authorize();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Manual list is required." }, { status: 400 });
    const list = await db.membershipManualList.findUnique({ where: { id }, select: { id: true } });
    if (!list) return NextResponse.json({ error: "Manual list not found." }, { status: 404 });
    await db.membershipManualList.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete manual list." }, { status: 400 });
  }
}
