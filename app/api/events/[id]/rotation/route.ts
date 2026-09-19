import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { selectRotationAssignments } from "@/lib/event-scheduling";
import { requireTenantScope } from "@/lib/tenant";

async function authorize() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return user;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const scope = await requireTenantScope();
    const event = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const assignments = await db.membershipEventVolunteerAssignment.findMany({
      where: { eventId: params.id },
      orderBy: [{ group: { position: "asc" } }, { individual: { lastName: "asc" } }],
      select: {
        id: true, groupId: true, source: true, scheduledIndividualId: true, rotationOrderId: true,
        group: { select: { name: true } },
        individual: { select: { id: true, firstName: true, lastName: true, email: true, cellphone: true, emailMessagesAllowed: true, smsMessagesAllowed: true, doNotContact: true } },
        notifications: { select: { channel: true, scheduledFor: true, status: true } }
      }
    });
    return NextResponse.json({ assignments });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load event rotation.");
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const scope = await requireTenantScope();
    const input = await request.json();
    const event = await db.membershipEvent.findFirst({
      where: { id: params.id, churchId: scope.church.id },
      select: { id: true, startsAt: true, volunteerGroups: { select: { groupId: true } } }
    });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const groupId = typeof input?.groupId === "string" ? input.groupId : "";
    if (!event.volunteerGroups.some((link) => link.groupId === groupId)) return NextResponse.json({ error: "Link this volunteer group to the event before assigning its rotation." }, { status: 400 });
    const adjustment = input?.action === "add" || input?.action === "remove" ? input.action : null;
    if (adjustment) {
      const individualId = typeof input?.individualId === "string" ? input.individualId : "";
      const member = await db.membershipVolunteerGroupMember.findFirst({ where: { groupId, individualId, group: { churchId: scope.church.id }, individual: { churchId: scope.church.id } }, select: { individualId: true } });
      if (!member) return NextResponse.json({ error: "Choose a volunteer who belongs to this group." }, { status: 400 });
      const existing = await db.membershipEventVolunteerAssignment.findFirst({ where: { eventId: event.id, groupId, individualId } });
      if (adjustment === "remove") {
        if (!existing) return NextResponse.json({ error: "That volunteer is not assigned to this event." }, { status: 404 });
        await db.membershipEventVolunteerAssignment.delete({ where: { id: existing.id } });
        await logAudit({ activityType: "membership-event-volunteer-assignment-updated", summary: `Removed a volunteer from event ${event.id}.`, details: JSON.stringify({ eventId: event.id, groupId, individualId, action: adjustment }), actorId: user.id });
        return NextResponse.json({ action: adjustment, individualId });
      }
      if (existing) return NextResponse.json({ error: "That volunteer is already assigned to this event." }, { status: 400 });
      const order = await db.membershipVolunteerRotationOrder.findFirst({ where: { groupId, isActive: true, group: { churchId: scope.church.id } }, orderBy: { updatedAt: "desc" }, select: { id: true, notificationLeadDays: true, notifyEmail: true, notifySms: true, notifyDayBefore: true } });
      if (!order) return NextResponse.json({ error: "Choose an active rotation order for this group before adding an event volunteer." }, { status: 400 });
      const assignment = await db.membershipEventVolunteerAssignment.create({
        data: { eventId: event.id, groupId, individualId, scheduledIndividualId: null, rotationOrderId: order.id, source: "OVERRIDE", notificationLeadMinutes: order.notificationLeadDays * 24 * 60 }
      });
      const channels = [
        ...(order.notifyEmail ? ["EMAIL" as const] : []),
        ...(order.notifySms ? ["SMS" as const] : [])
      ];
      if (channels.length) {
        const scheduledFor = new Date(event.startsAt.getTime() - order.notificationLeadDays * 24 * 60 * 60_000);
        const notifications = channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "PRIMARY", scheduledFor }));
        if (order.notifyDayBefore) notifications.push(...channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "DAY_BEFORE", scheduledFor: new Date(event.startsAt.getTime() - 24 * 60 * 60_000) })));
        await db.membershipVolunteerNotification.createMany({ data: notifications });
      }
      await logAudit({ activityType: "membership-event-volunteer-assignment-updated", summary: `Added a volunteer to event ${event.id}.`, details: JSON.stringify({ eventId: event.id, groupId, individualId, action: adjustment }), actorId: user.id });
      return NextResponse.json({ action: adjustment, individualId });
    }
    const orderId = typeof input?.orderId === "string" ? input.orderId : "";
    const order = await db.membershipVolunteerRotationOrder.findFirst({
      where: { id: orderId, group: { churchId: scope.church.id } },
      include: { entries: { orderBy: { position: "asc" }, select: { individualId: true } } }
    });
    if (!order || order.groupId !== groupId || !order.isActive || !order.entries.length) return NextResponse.json({ error: "Choose an active rotation order for this group." }, { status: 400 });
    const overrideIds: string[] = Array.isArray(input?.overrideIndividualIds) ? Array.from(new Set<string>(input.overrideIndividualIds.filter((id: unknown): id is string => typeof id === "string"))) : [];
    const validMembers = await db.membershipVolunteerGroupMember.findMany({ where: { groupId, individualId: { in: overrideIds.length ? overrideIds : order.entries.map((entry) => entry.individualId) }, group: { churchId: scope.church.id }, individual: { churchId: scope.church.id } }, select: { individualId: true } });
    const validIds = new Set(validMembers.map((member) => member.individualId));
    if (overrideIds.some((id) => !validIds.has(id))) return NextResponse.json({ error: "Every override volunteer must belong to the linked group." }, { status: 400 });
    const overrideAssignmentId = typeof input?.overrideAssignmentId === "string" ? input.overrideAssignmentId : "";
    const replacementIndividualId = typeof input?.replacementIndividualId === "string" ? input.replacementIndividualId : "";
    if (overrideAssignmentId || replacementIndividualId) {
      const replacementMember = replacementIndividualId ? await db.membershipVolunteerGroupMember.findFirst({ where: { groupId, individualId: replacementIndividualId, group: { churchId: scope.church.id }, individual: { churchId: scope.church.id } }, select: { individualId: true } }) : null;
      if (!overrideAssignmentId || !replacementIndividualId || !replacementMember) return NextResponse.json({ error: "Choose a valid replacement volunteer." }, { status: 400 });
      const existing = await db.membershipEventVolunteerAssignment.findFirst({ where: { id: overrideAssignmentId, eventId: event.id, groupId } });
      if (!existing) return NextResponse.json({ error: "The event assignment was not found." }, { status: 404 });
      const source = existing.scheduledIndividualId === replacementIndividualId ? "ROTATION" : "OVERRIDE";
      await db.membershipEventVolunteerAssignment.update({ where: { id: existing.id }, data: { individualId: replacementIndividualId, source } });
      await logAudit({ activityType: "membership-event-volunteer-assignment-updated", summary: `Overrode a volunteer assignment for event ${event.id}.`, details: JSON.stringify({ eventId: event.id, groupId, assignmentId: existing.id, replacementIndividualId, source }), actorId: user.id });
      return NextResponse.json({ assignedIndividualIds: [replacementIndividualId], source });
    }

    const rotation = selectRotationAssignments(order.entries.map((entry) => entry.individualId), order.nextPosition, order.batchSize);
    const selectedIds = overrideIds.length ? overrideIds : rotation.selectedIds;
    const nextPosition = overrideIds.length ? order.nextPosition : rotation.nextPosition;
    const scheduledFor = new Date(event.startsAt.getTime() - order.notificationLeadDays * 24 * 60 * 60_000);
    await db.$transaction(async (transaction) => {
      await transaction.membershipEventVolunteerAssignment.deleteMany({ where: { eventId: event.id, groupId } });
      for (const individualId of selectedIds) {
        const assignment = await transaction.membershipEventVolunteerAssignment.create({
          data: {
            eventId: event.id,
            groupId,
            individualId,
            scheduledIndividualId: individualId,
            rotationOrderId: order.id,
            source: overrideIds.length ? "OVERRIDE" : "ROTATION",
            notificationLeadMinutes: order.notificationLeadDays * 24 * 60
          }
        });
        await logAudit({ activityType: "membership-event-volunteer-assignment-updated", summary: `Applied ${overrideIds.length ? "an override" : "the volunteer rotation"} to event ${event.id}.`, details: JSON.stringify({ eventId: event.id, groupId, orderId: order.id, assignedIndividualIds: selectedIds, source: overrideIds.length ? "OVERRIDE" : "ROTATION", nextPosition }), actorId: user.id });
        const channels = [
          ...(order.notifyEmail ? ["EMAIL" as const] : []),
          ...(order.notifySms ? ["SMS" as const] : [])
        ];
        if (channels.length) {
          const notifications = channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "PRIMARY", scheduledFor }));
          if (order.notifyDayBefore) notifications.push(...channels.map((channel) => ({ assignmentId: assignment.id, channel, kind: "DAY_BEFORE", scheduledFor: new Date(event.startsAt.getTime() - 24 * 60 * 60_000) })));
          await transaction.membershipVolunteerNotification.createMany({ data: notifications });
        }
      }
      if (!overrideIds.length) await transaction.membershipVolunteerRotationOrder.update({ where: { id: order.id }, data: { nextPosition } });
    });
    return NextResponse.json({ assignedIndividualIds: selectedIds, source: overrideIds.length ? "OVERRIDE" : "ROTATION" });
  } catch (error) {
    return apiErrorResponse(error, "Unable to apply the rotation to this event.");
  }
}
