import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireTenantScope } from "@/lib/tenant";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return requireTenantScope();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SYSTEM_ROLE_SLUGS = new Set(["head-of-household", "spouse", "child", "other"]);

export async function GET() {
  try {
    const scope = await authorize();
    const roles = await db.membershipFamilyRole.findMany({
      where: { churchId: scope.church.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, _count: { select: { individuals: true } } }
    });
    return NextResponse.json({ roles });
  } catch {
    return NextResponse.json({ error: "Unable to load family roles." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const slug = slugify(name);
    if (!name || name.length > 80 || !slug) return NextResponse.json({ error: "Enter a valid family role name." }, { status: 400 });
    const role = await db.membershipFamilyRole.create({
      data: { churchId: scope.church.id, name, slug },
      select: { id: true, name: true, slug: true, _count: { select: { individuals: true } } }
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to add family role. A role with that name may already exist." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await authorize();
    const input = await request.json();
    const id = typeof input?.id === "string" ? input.id.trim() : "";
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const slug = slugify(name);
    if (!id || !name || name.length > 80 || !slug) return NextResponse.json({ error: "Enter a valid family role name." }, { status: 400 });
    const existing = await db.membershipFamilyRole.findFirst({ where: { id, churchId: scope.church.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Family role not found." }, { status: 404 });
    const current = await db.membershipFamilyRole.findFirst({ where: { id, churchId: scope.church.id }, select: { slug: true } });
    if (!current) return NextResponse.json({ error: "Family role not found." }, { status: 404 });
    const role = await db.membershipFamilyRole.update({
      where: { id },
      data: { name, slug: SYSTEM_ROLE_SLUGS.has(current.slug) ? current.slug : slug },
      select: { id: true, name: true, slug: true, _count: { select: { individuals: true } } }
    });
    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ error: "Unable to update family role. A role with that name may already exist." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const scope = await authorize();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Family role is required." }, { status: 400 });
    const role = await db.membershipFamilyRole.findFirst({ where: { id, churchId: scope.church.id }, select: { id: true, _count: { select: { individuals: true } } } });
    if (!role) return NextResponse.json({ error: "Family role not found." }, { status: 404 });
    const roleDetails = await db.membershipFamilyRole.findUnique({ where: { id: role.id }, select: { slug: true } });
    if (roleDetails && SYSTEM_ROLE_SLUGS.has(roleDetails.slug)) return NextResponse.json({ error: "Default family roles cannot be deleted." }, { status: 409 });
    if (role._count.individuals > 0) return NextResponse.json({ error: "This family role is in use and cannot be deleted. Reassign those individuals first." }, { status: 409 });
    await db.membershipFamilyRole.delete({ where: { id: role.id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete family role." }, { status: 400 });
  }
}
