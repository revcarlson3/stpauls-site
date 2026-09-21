import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant";
import { audienceSlug, dynamicMemberIds, normalizeCriteria } from "@/lib/membership-audiences";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return requireTenantScope();
}

async function withCounts(lists: Array<{ id: string; name: string; description: string | null; slug: string; criteria: unknown; createdAt: Date; updatedAt: Date }>) {
  return Promise.all(lists.map(async (list) => ({ ...list, criteria: normalizeCriteria(list.criteria), count: (await dynamicMemberIds(list.criteria)).length })));
}

export async function GET() {
  try {
    const scope = await authorize();
    const lists = await db.membershipDynamicList.findMany({ where: { churchId: scope.church.id }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, slug: true, criteria: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ lists: await withCounts(lists) });
  } catch {
    return NextResponse.json({ error: "Unable to load dynamic lists." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof input?.description === "string" ? input.description.trim().slice(0, 500) : null;
    if (!name || name.length > 100) return NextResponse.json({ error: "Enter a dynamic list name." }, { status: 400 });
    const criteria = normalizeCriteria(input?.criteria);
    const list = await db.membershipDynamicList.create({ data: { churchId: scope.church.id, name, description, slug: `${audienceSlug(name)}-${Date.now().toString(36)}`, criteria }, select: { id: true, name: true, description: true, slug: true, criteria: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ list: { ...list, criteria, count: (await dynamicMemberIds(criteria)).length } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create dynamic list." }, { status: 400 });
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
    const hasCriteria = Object.prototype.hasOwnProperty.call(input, "criteria");
    const existing = hasCriteria ? null : await db.membershipDynamicList.findUnique({ where: { id }, select: { criteria: true } });
    if (!hasCriteria && !existing) return NextResponse.json({ error: "Dynamic list not found." }, { status: 404 });
    const criteria = normalizeCriteria(hasCriteria ? input?.criteria : existing?.criteria);
    const list = await db.membershipDynamicList.update({ where: { id }, data: { name, criteria, ...(description !== undefined ? { description: description || null } : {}) }, select: { id: true, name: true, description: true, slug: true, criteria: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ list: { ...list, criteria, count: (await dynamicMemberIds(criteria)).length } });
  } catch {
    return NextResponse.json({ error: "Unable to save dynamic list." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await authorize();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Dynamic list is required." }, { status: 400 });
    await db.membershipDynamicList.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete dynamic list." }, { status: 400 });
  }
}
