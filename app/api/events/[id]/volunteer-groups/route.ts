import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";
import { logAudit } from "@/lib/audit";
import { requireTenantScope } from "@/lib/tenant";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    const input = await request.json() as { groupIds?: unknown; applyToSeries?: unknown };
    if (!Array.isArray(input.groupIds) || input.groupIds.some((id) => typeof id !== "string")) return NextResponse.json({ error: "Select valid volunteer groups." }, { status: 400 });
    const groupIds = Array.from(new Set(input.groupIds as string[]));
    const sourceEvent = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { startsAt: true, recurrenceGroupId: true } });
    if (!sourceEvent) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const groups = await db.membershipVolunteerGroup.findMany({ where: { id: { in: groupIds }, churchId: scope.church.id }, select: { id: true } });
    if (groups.length !== groupIds.length) return NextResponse.json({ error: "Select volunteer groups from this church." }, { status: 400 });
    const targetEvents = input.applyToSeries === true && sourceEvent.recurrenceGroupId
      ? await db.membershipEvent.findMany({ where: { recurrenceGroupId: sourceEvent.recurrenceGroupId, churchId: scope.church.id }, select: { id: true, startsAt: true }, orderBy: { startsAt: "asc" } })
      : [{ id: params.id, startsAt: sourceEvent.startsAt }];
    await db.$transaction(targetEvents.flatMap((event) => [
      db.membershipEventVolunteerGroup.deleteMany({ where: { eventId: event.id } }),
      ...(groupIds.length ? [db.membershipEventVolunteerGroup.createMany({ data: groupIds.map((groupId) => ({ eventId: event.id, groupId })) })] : [])
    ]));
    for (const targetEvent of targetEvents) {
      const event = targetEvent;
      for (const groupId of groupIds) {
        const order = await db.membershipVolunteerRotationOrder.findFirst({
          where: { groupId, isActive: true, group: { churchId: scope.church.id } },
          orderBy: { updatedAt: "desc" },
          include: { entries: { orderBy: { position: "asc" }, select: { individualId: true } } }
        });
        if (!order || !order.entries.length) continue;
        const existing = await db.membershipEventVolunteerAssignment.count({ where: { eventId: event.id, groupId } });
        if (existing) continue;
        const batchSize = Math.min(order.batchSize, order.entries.length);
        const selectedIds = order.entries.slice(order.nextPosition, order.nextPosition + batchSize).map((entry) => entry.individualId)
          .concat(order.nextPosition + batchSize > order.entries.length ? order.entries.slice(0, (order.nextPosition + batchSize) % order.entries.length).map((entry) => entry.individualId) : []);
        const nextPosition = (order.nextPosition + selectedIds.length) % order.entries.length;
        const primaryDate = new Date(event.startsAt.getTime() - order.notificationLeadDays * 24 * 60 * 60_000);
        await db.$transaction(async (transaction) => {
          for (const individualId of selectedIds) {
            const assignment = await transaction.membershipEventVolunteerAssignment.create({
              data: { eventId: event.id, groupId, individualId, rotationOrderId: order.id, source: "ROTATION", notificationLeadMinutes: order.notificationLeadDays * 24 * 60 }
            });
            const channels = [
              ...(order.notifyEmail ? ["EMAIL" as const] : []),
              ...(order.notifySms ? ["SMS" as const] : [])
            ];
            const notifications = channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "PRIMARY", scheduledFor: primaryDate }));
            if (order.notifyDayBefore) notifications.push(...channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "DAY_BEFORE", scheduledFor: new Date(event.startsAt.getTime() - 24 * 60 * 60_000) })));
            if (notifications.length) await transaction.membershipVolunteerNotification.createMany({ data: notifications });
          }
          await transaction.membershipVolunteerRotationOrder.update({ where: { id: order.id }, data: { nextPosition } });
        });
      }
    }
    await logAudit({ activityType: "membership-event-volunteer-assignment-updated", summary: `Updated volunteer groups for ${targetEvents.length} event${targetEvents.length === 1 ? "" : "s"}.`, details: JSON.stringify({ eventId: params.id, eventCount: targetEvents.length, groupIds, applyToSeries: input.applyToSeries === true }), actorId: user.id });
    return NextResponse.json({ saved: groupIds.length });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save volunteer groups.");
  }
}
