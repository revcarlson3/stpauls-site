import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

async function authorize() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return user;
}

export async function GET() {
  try {
    await authorize();
    const orders = await db.membershipVolunteerRotationOrder.findMany({
      orderBy: [{ group: { position: "asc" } }, { name: "asc" }],
      include: {
        group: { select: { id: true, name: true } },
        entries: {
          orderBy: { position: "asc" },
          select: { id: true, position: true, individual: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "Unable to load rotation orders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize();
    const input = await request.json();
    const groupId = typeof input?.groupId === "string" ? input.groupId : "";
    const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : "";
    let individualIds = Array.isArray(input?.individualIds) ? input.individualIds.filter((id: unknown): id is string => typeof id === "string") : [];
    if (!groupId || !name) return NextResponse.json({ error: "A group and name are required." }, { status: 400 });
    if (!individualIds.length) {
      const groupMembers = await db.membershipVolunteerGroupMember.findMany({ where: { groupId }, orderBy: { individual: { lastName: "asc" } }, select: { individualId: true } });
      individualIds = groupMembers.map((member) => member.individualId);
    }
    if (!individualIds.length) return NextResponse.json({ error: "The selected volunteer group has no members." }, { status: 400 });
    const members = await db.membershipVolunteerGroupMember.findMany({ where: { groupId, individualId: { in: individualIds } }, select: { individualId: true } });
    const validIds = new Set(members.map((member) => member.individualId));
    if (individualIds.some((individualId: string) => !validIds.has(individualId))) return NextResponse.json({ error: "Every selected volunteer must belong to the chosen group." }, { status: 400 });
    const order = await db.membershipVolunteerRotationOrder.create({
      data: {
        groupId,
        name,
        batchSize: Number.isInteger(input?.batchSize) ? Math.max(1, Math.min(50, input.batchSize)) : 1,
        notificationLeadDays: Number.isInteger(input?.notificationLeadDays) ? Math.max(0, Math.min(365, input.notificationLeadDays)) : 7,
        notifyEmail: input?.notifyEmail !== false,
        notifySms: input?.notifySms !== false,
        notifyDayBefore: input?.notifyDayBefore === true,
        entries: { create: individualIds.map((individualId: string, position: number) => ({ individualId, position })) }
      },
      include: { group: { select: { id: true, name: true } }, entries: { orderBy: { position: "asc" }, include: { individual: { select: { id: true, firstName: true, lastName: true } } } } }
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create the rotation order." }, { status: 500 });
  }
}
