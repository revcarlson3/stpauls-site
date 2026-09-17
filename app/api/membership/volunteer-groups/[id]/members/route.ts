import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return user;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const sort = new URL(request.url).searchParams.get("sort") || "lastName";
    const orderBy = sort === "firstName" ? { individual: { firstName: "asc" as const } } : sort === "assignedAt" ? { assignedAt: "asc" as const } : { individual: { lastName: "asc" as const } };
    const group = await db.membershipVolunteerGroup.findUnique({
      where: { id: params.id },
      select: {
        members: {
          orderBy,
          select: {
            assignedAt: true, role: true, isLeader: true, availability: true, skills: true,
            individual: { select: { id: true, firstName: true, lastName: true, family: { select: { lastName: true } } } }
          }
        },
        assignmentHistory: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { id: true, individualId: true, action: true, role: true, isLeader: true, availability: true, skills: true, createdAt: true, individual: { select: { firstName: true, lastName: true, family: { select: { lastName: true } } } }, changedBy: { select: { name: true } } }
        }
      }
    });
    if (!group) return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
    return NextResponse.json({ members: group.members.map(({ individual, ...assignment }) => ({ ...individual, ...assignment })), history: group.assignmentHistory });
  } catch {
    return NextResponse.json({ error: "Unable to load group members." }, { status: 403 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const input = await request.json();
    type RequestedMember = { individualId?: unknown; role?: unknown; isLeader?: unknown; availability?: unknown; skills?: unknown };
    const requestedMembers: RequestedMember[] = Array.isArray(input?.members) ? input.members.filter((entry: unknown): entry is RequestedMember => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
    const memberIds = Array.from(new Set<string>((Array.isArray(input?.memberIds) ? input.memberIds : requestedMembers.map((entry) => entry.individualId)).filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim())).map((id: string) => id.trim())));
    const group = await db.membershipVolunteerGroup.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!group) return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
    const valid = await db.membershipIndividual.findMany({ where: { id: { in: memberIds }, status: { not: "REMOVED" } }, select: { id: true } });
    const details: RequestedMember[] = requestedMembers.length ? requestedMembers : memberIds.map((individualId) => ({ individualId }));
    const detailById = new Map(details.map((entry) => [typeof entry.individualId === "string" ? entry.individualId.trim() : "", entry]));
    const existing = await db.membershipVolunteerGroupMember.findMany({ where: { groupId: params.id } });
    const existingById = new Map(existing.map((entry) => [entry.individualId, entry]));
    const next = valid.map(({ id }) => {
      const source = detailById.get(id) ?? {};
      return {
        individualId: id,
        role: typeof source.role === "string" ? source.role.trim().slice(0, 120) || null : null,
        isLeader: source.isLeader === true,
        availability: source.availability && typeof source.availability === "object" ? source.availability : null,
        skills: typeof source.skills === "string" ? source.skills.trim().slice(0, 500) || null : null
      };
    });
    const changes = [
      ...existing.filter((entry) => !next.some((item) => item.individualId === entry.individualId)).map((entry) => db.membershipVolunteerAssignment.create({ data: { groupId: params.id, individualId: entry.individualId, action: "REMOVED", role: entry.role, isLeader: entry.isLeader, availability: entry.availability ?? undefined, skills: entry.skills, changedById: user.id } })),
      ...next.filter((entry) => {
        const old = existingById.get(entry.individualId);
        return !old || old.role !== entry.role || old.isLeader !== entry.isLeader || old.skills !== entry.skills || JSON.stringify(old.availability) !== JSON.stringify(entry.availability);
      }).map((entry) => db.membershipVolunteerAssignment.create({ data: { groupId: params.id, individualId: entry.individualId, action: existingById.has(entry.individualId) ? "UPDATED" : "ASSIGNED", role: entry.role, isLeader: entry.isLeader, availability: entry.availability ?? undefined, skills: entry.skills, changedById: user.id } }))
    ];
    await db.$transaction([
      db.membershipVolunteerGroupMember.deleteMany({ where: { groupId: params.id } }),
      db.membershipVolunteerGroupMember.createMany({ data: next.map((entry) => ({ groupId: params.id, ...entry, availability: entry.availability ?? undefined })) }),
      ...changes
    ]);
    const activeOrders = await db.membershipVolunteerRotationOrder.findMany({
      where: { groupId: params.id, isActive: true },
      include: { entries: { orderBy: { position: "desc" }, take: 1, select: { individualId: true, position: true } } }
    });
    const addedMemberIds = next.map((entry) => entry.individualId);
    for (const order of activeOrders) {
      const existingIds = new Set((await db.membershipVolunteerRotationEntry.findMany({ where: { orderId: order.id }, select: { individualId: true } })).map((entry) => entry.individualId));
      const newIds = addedMemberIds.filter((individualId) => !existingIds.has(individualId));
      if (!newIds.length) continue;
      await db.membershipVolunteerRotationEntry.createMany({
        data: newIds.map((individualId, index) => ({ orderId: order.id, individualId, position: (order.entries[0]?.position ?? -1) + index + 1 }))
      });
    }
    return NextResponse.json({ saved: true, count: next.length });
  } catch {
    return NextResponse.json({ error: "Unable to save group members." }, { status: 400 });
  }
}
