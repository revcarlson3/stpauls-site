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
    const groups = await db.membershipVolunteerGroup.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true, slug: true, position: true, members: { where: { isLeader: true }, select: { individualId: true } }, _count: { select: { members: true } } }
    });
    return NextResponse.json({ groups: groups.map(({ members, ...group }) => ({ ...group, leaderCount: members.length })) });
  } catch {
    return NextResponse.json({ error: "Unable to load volunteer groups." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof input?.description === "string" ? input.description.trim().slice(0, 500) : null;
    if (!name || name.length > 100) return NextResponse.json({ error: "Enter a volunteer group name." }, { status: 400 });
    const last = await db.membershipVolunteerGroup.aggregate({ _max: { position: true } });
    const copyOfId = typeof input?.copyOfId === "string" ? input.copyOfId.trim() : "";
    const source = copyOfId ? await db.membershipVolunteerGroup.findUnique({ where: { id: copyOfId }, select: { members: { select: { individualId: true, role: true, isLeader: true, availability: true, skills: true } } } }) : null;
    if (copyOfId && !source) return NextResponse.json({ error: "Volunteer group to duplicate was not found." }, { status: 404 });
    const group = await db.membershipVolunteerGroup.create({
      data: { name, description, slug: `${audienceSlug(name)}-${Date.now().toString(36)}`, position: (last._max.position ?? -1) + 1, ...(source ? { members: { create: source.members.map((member) => ({ role: member.role, isLeader: member.isLeader, availability: member.availability ?? undefined, skills: member.skills, individual: { connect: { id: member.individualId } } })) } } : {}) },
      select: { id: true, name: true, description: true, slug: true, position: true, members: { where: { isLeader: true }, select: { individualId: true } }, _count: { select: { members: true } } }
    });
    const { members, ...groupData } = group;
    return NextResponse.json({ group: { ...groupData, leaderCount: members.length } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create volunteer group." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    if (Array.isArray(input?.ids)) {
      const ids = input.ids.filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim())).map((id: string) => id.trim());
      const existing = await db.membershipVolunteerGroup.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (!ids.length || new Set(ids).size !== ids.length || existing.length !== ids.length) return NextResponse.json({ error: "The volunteer group order is out of date." }, { status: 409 });
      await db.$transaction(ids.map((id: string, position: number) => db.membershipVolunteerGroup.update({ where: { id }, data: { position } })));
      return NextResponse.json({ saved: true });
    }
    const id = typeof input?.id === "string" ? input.id.trim() : "";
    const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof input?.description === "string" ? input.description.trim().slice(0, 500) : undefined;
    if (!id || !name || name.length > 100) return NextResponse.json({ error: "Group and name are required." }, { status: 400 });
    const group = await db.membershipVolunteerGroup.update({ where: { id }, data: { name, ...(description !== undefined ? { description: description || null } : {}) }, select: { id: true, name: true, description: true, slug: true, position: true, members: { where: { isLeader: true }, select: { individualId: true } }, _count: { select: { members: true } } } });
    const { members, ...groupData } = group;
    return NextResponse.json({ group: { ...groupData, leaderCount: members.length } });
  } catch {
    return NextResponse.json({ error: "Unable to save volunteer group." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await authorize();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Volunteer group is required." }, { status: 400 });
    const group = await db.membershipVolunteerGroup.findUnique({ where: { id }, select: { _count: { select: { members: true } } } });
    if (!group) return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
    if (group._count.members) return NextResponse.json({ error: "Remove all members before deleting this group." }, { status: 409 });
    await db.membershipVolunteerGroup.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete volunteer group." }, { status: 400 });
  }
}
