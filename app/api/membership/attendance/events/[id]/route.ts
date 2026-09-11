import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import { MembershipAttendanceInputError, normalizeMembershipEventInput } from "@/lib/membership-attendance";

async function authorize() {
  return authorizeVolunteerScheduling();
}

const eventSelection = {
  id: true, title: true, description: true, eventType: true, status: true, category: true, location: true,
  startsAt: true, endsAt: true, timeZone: true, createdAt: true, updatedAt: true, _count: { select: { attendance: true } }
} as const;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const event = await db.membershipEvent.findUnique({ where: { id: params.id }, select: eventSelection });
    if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    const grouped = await db.membershipAttendanceRecord.groupBy({ by: ["status"], where: { eventId: params.id }, _count: { _all: true } });
    const { _count, ...details } = event;
    return NextResponse.json({ event: { ...details, attendanceCount: _count.attendance, attendanceByStatus: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) } });
  } catch {
    return NextResponse.json({ error: "Unable to load membership event." }, { status: 403 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const current = await db.membershipEvent.findUnique({ where: { id: params.id }, select: { id: true, title: true, startsAt: true, endsAt: true } });
    if (!current) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    const data = normalizeMembershipEventInput(await request.json(), true);
    if (!Object.keys(data).length) return NextResponse.json({ error: "Provide at least one event field to update." }, { status: 400 });
    if (data.title === null) return NextResponse.json({ error: "Event title is required." }, { status: 400 });
    if (data.startsAt === null) return NextResponse.json({ error: "Event start is required." }, { status: 400 });
    const nextStart = data.startsAt ?? current.startsAt;
    const nextEnd = data.endsAt === undefined ? current.endsAt : data.endsAt;
    if (nextEnd && nextEnd <= nextStart) return NextResponse.json({ error: "Event end must be after its start." }, { status: 400 });
    const { title, startsAt, ...optionalData } = data;
    const event = await db.membershipEvent.update({
      where: { id: params.id },
      data: { ...optionalData, ...(typeof title === "string" ? { title } : {}), ...(startsAt instanceof Date ? { startsAt } : {}) },
      select: { id: true, title: true, description: true, eventType: true, status: true, category: true, location: true, startsAt: true, endsAt: true, timeZone: true, createdAt: true, updatedAt: true }
    });
    await logAudit({ activityType: "membership-event-updated", summary: `Updated membership event “${event.title}”.`, details: JSON.stringify({ eventId: event.id }), actorId: user.id });
    const attendanceCount = await db.membershipAttendanceRecord.count({ where: { eventId: event.id } });
    return NextResponse.json({ event: { ...event, attendanceCount } });
  } catch (error) {
    if (error instanceof MembershipAttendanceInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update membership event." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const event = await db.membershipEvent.findUnique({ where: { id: params.id }, select: { id: true, title: true, _count: { select: { attendance: true } } } });
    if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    if (event._count.attendance) return NextResponse.json({ error: "This event has attendance history. Cancel it instead of deleting it." }, { status: 409 });
    await db.membershipEvent.delete({ where: { id: params.id } });
    await logAudit({ activityType: "membership-event-deleted", summary: `Deleted membership event “${event.title}”.`, details: JSON.stringify({ eventId: event.id }), actorId: user.id });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete membership event." }, { status: 500 });
  }
}
