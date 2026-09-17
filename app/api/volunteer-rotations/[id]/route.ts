import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

async function createNotifications(transaction: Prisma.TransactionClient, assignmentId: string, order: { notifyEmail: boolean; notifySms: boolean; notifyDayBefore: boolean; notificationLeadDays: number }, eventStartsAt: Date) {
  const channels = [
    ...(order.notifyEmail ? ["EMAIL" as const] : []),
    ...(order.notifySms ? ["SMS" as const] : [])
  ];
  if (!channels.length) return;
  const notifications = channels.map((channel) => ({ assignmentId, channel, kind: "PRIMARY", scheduledFor: new Date(eventStartsAt.getTime() - order.notificationLeadDays * 24 * 60 * 60_000) }));
  if (order.notifyDayBefore) notifications.push(...channels.map((channel) => ({ assignmentId, channel, kind: "DAY_BEFORE", scheduledFor: new Date(eventStartsAt.getTime() - 24 * 60 * 60_000) })));
  await transaction.membershipVolunteerNotification.createMany({ data: notifications });
}

async function authorize() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return user;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const input = await request.json();
    if (input?.applyToLinkedEvents !== true) return NextResponse.json({ error: "A bulk rotation action is required." }, { status: 400 });
    const order = await db.membershipVolunteerRotationOrder.findUnique({
      where: { id: params.id },
      include: { entries: { orderBy: { position: "asc" }, select: { individualId: true } } }
    });
    if (!order || !order.isActive || !order.entries.length) return NextResponse.json({ error: "Choose an active rotation order with volunteers." }, { status: 400 });
    const events = await db.membershipEvent.findMany({
      where: {
        startsAt: { gte: new Date() },
        status: { not: "CANCELLED" },
        volunteerGroups: { some: { groupId: order.groupId } },
        rotationAssignments: { none: { groupId: order.groupId } }
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true }
    });
    let nextPosition = order.nextPosition;
    for (const event of events) {
      const size = Math.min(order.batchSize, order.entries.length);
      const selectedIds = order.entries.slice(nextPosition, nextPosition + size).map((entry) => entry.individualId)
        .concat(nextPosition + size > order.entries.length ? order.entries.slice(0, (nextPosition + size) % order.entries.length).map((entry) => entry.individualId) : []);
      nextPosition = (nextPosition + selectedIds.length) % order.entries.length;
      await db.$transaction(async (transaction) => {
        for (const individualId of selectedIds) {
          const assignment = await transaction.membershipEventVolunteerAssignment.create({
            data: { eventId: event.id, groupId: order.groupId, individualId, scheduledIndividualId: individualId, rotationOrderId: order.id, source: "ROTATION", notificationLeadMinutes: order.notificationLeadDays * 24 * 60 }
          });
          await createNotifications(transaction, assignment.id, order, event.startsAt);
        }
        await transaction.membershipVolunteerRotationOrder.update({ where: { id: order.id }, data: { nextPosition } });
      });
    }
    return NextResponse.json({ appliedEventCount: events.length, nextPosition });
  } catch {
    return NextResponse.json({ error: "Unable to apply the rotation to linked events." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const input = await request.json();
    const order = await db.membershipVolunteerRotationOrder.findUnique({ where: { id: params.id }, select: { id: true, groupId: true, nextPosition: true, batchSize: true, notificationLeadDays: true, notifyEmail: true, notifySms: true, notifyDayBefore: true, entries: { select: { id: true, individualId: true } } } });
    if (!order) return NextResponse.json({ error: "Rotation order not found." }, { status: 404 });
    const moveBackOneBatch = input?.moveBackOneBatch === true;
    const reassignEvents = input?.reassignEvents === true;
    const previousPosition = order.entries.length
      ? (order.nextPosition - Math.min(order.batchSize, order.entries.length) + order.entries.length) % order.entries.length
      : order.nextPosition;
    let reassignedEventCount = 0;
    let skippedOverrideEventCount = 0;
    if (moveBackOneBatch && reassignEvents && order.entries.length) {
      const entries = await db.membershipVolunteerRotationEntry.findMany({ where: { orderId: params.id }, orderBy: { position: "asc" }, select: { individualId: true } });
      const assignments = await db.membershipEventVolunteerAssignment.findMany({
        where: { rotationOrderId: params.id, groupId: order.groupId },
        orderBy: { event: { startsAt: "asc" } },
        select: { id: true, eventId: true, individualId: true, source: true, event: { select: { startsAt: true } } }
      });
      const assignmentsByEvent = new Map<string, typeof assignments>();
      for (const assignment of assignments) assignmentsByEvent.set(assignment.eventId, [...(assignmentsByEvent.get(assignment.eventId) ?? []), assignment]);
      for (const eventAssignments of Array.from(assignmentsByEvent.values())) {
        if (eventAssignments.some((assignment) => assignment.source === "OVERRIDE")) {
          skippedOverrideEventCount++;
          continue;
        }
        const currentPosition = entries.findIndex((entry) => entry.individualId === eventAssignments[0].individualId);
        if (currentPosition < 0) continue;
        const size = Math.min(order.batchSize, entries.length);
        const start = (currentPosition - size + entries.length) % entries.length;
        const selectedIds = entries.slice(start, start + size).map((entry) => entry.individualId)
          .concat(start + size > entries.length ? entries.slice(0, (start + size) % entries.length).map((entry) => entry.individualId) : []);
        await db.$transaction(async (transaction) => {
          const assignmentIds = eventAssignments.map((assignment: typeof assignments[number]) => assignment.id);
          await transaction.membershipVolunteerNotification.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
          await transaction.membershipEventVolunteerAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
          const scheduledFor = new Date(eventAssignments[0].event.startsAt.getTime() - order.notificationLeadDays * 24 * 60 * 60_000);
          for (const individualId of selectedIds) {
            const assignment = await transaction.membershipEventVolunteerAssignment.create({
              data: { eventId: eventAssignments[0].eventId, groupId: order.groupId, individualId, scheduledIndividualId: individualId, rotationOrderId: params.id, source: "ROTATION", notificationLeadMinutes: order.notificationLeadDays * 24 * 60 }
            });
            const channels = [
              ...(order.notifyEmail ? ["EMAIL" as const] : []),
              ...(order.notifySms ? ["SMS" as const] : [])
            ];
            if (channels.length) {
              const notifications = channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "PRIMARY", scheduledFor }));
              if (order.notifyDayBefore) notifications.push(...channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "DAY_BEFORE", scheduledFor: new Date(eventAssignments[0].event.startsAt.getTime() - 24 * 60 * 60_000) })));
              await transaction.membershipVolunteerNotification.createMany({ data: notifications });
            }
          }
        });
        reassignedEventCount++;
      }
    }
    const requestedIndividualIds = Array.isArray(input?.individualIds)
      ? input.individualIds.filter((id: unknown): id is string => typeof id === "string")
      : null;
    const individualIds: string[] | null = requestedIndividualIds?.length
      ? requestedIndividualIds
      : Array.isArray(input?.individualIds)
        ? order.entries.map((entry) => entry.individualId)
        : null;
    if (individualIds) {
      if (!individualIds.length) return NextResponse.json({ error: "A rotation order must include at least one volunteer." }, { status: 400 });
      const members = await db.membershipVolunteerGroupMember.findMany({ where: { groupId: order.groupId, individualId: { in: individualIds } }, select: { individualId: true } });
      const validIds = new Set(members.map((member) => member.individualId));
      if (individualIds.some((individualId) => !validIds.has(individualId))) return NextResponse.json({ error: "Every selected volunteer must belong to the order's group." }, { status: 400 });
      await db.$transaction([
        db.membershipVolunteerRotationEntry.deleteMany({ where: { orderId: params.id } }),
        db.membershipVolunteerRotationEntry.createMany({ data: individualIds.map((individualId, position) => ({ orderId: params.id, individualId, position })) })
      ]);
    }
    const updated = await db.membershipVolunteerRotationOrder.update({
      where: { id: params.id },
      data: {
        ...(typeof input?.name === "string" ? { name: input.name.trim().slice(0, 120) } : {}),
        ...(typeof input?.isActive === "boolean" ? { isActive: input.isActive } : {}),
        ...(Number.isInteger(input?.batchSize) ? { batchSize: Math.max(1, Math.min(50, input.batchSize)) } : {}),
        ...(Number.isInteger(input?.notificationLeadDays) ? { notificationLeadDays: Math.max(0, Math.min(365, input.notificationLeadDays)) } : {}),
        ...(typeof input?.notifyEmail === "boolean" ? { notifyEmail: input.notifyEmail } : {}),
        ...(typeof input?.notifySms === "boolean" ? { notifySms: input.notifySms } : {}),
        ...(typeof input?.notifyDayBefore === "boolean" ? { notifyDayBefore: input.notifyDayBefore } : {}),
        ...(moveBackOneBatch && order.entries.length ? { nextPosition: previousPosition } : {})
      },
      include: { group: { select: { id: true, name: true } }, entries: { orderBy: { position: "asc" }, include: { individual: { select: { id: true, firstName: true, lastName: true } } } } }
    });
    return NextResponse.json({ order: updated, reassignedEventCount, skippedOverrideEventCount });
  } catch {
    return NextResponse.json({ error: "Unable to update the rotation order." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    await db.$transaction([
      db.membershipEventVolunteerAssignment.deleteMany({ where: { rotationOrderId: params.id } }),
      db.membershipVolunteerRotationOrder.delete({ where: { id: params.id } })
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete the rotation order." }, { status: 500 });
  }
}
