import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import { MembershipVolunteerInputError, normalizeServiceShiftInput } from "@/lib/membership-volunteers";

async function authorize() {
  return authorizeVolunteerScheduling();
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { opportunityId: _opportunityId, ...data } = normalizeServiceShiftInput(await request.json(), true);
    const shift = await db.membershipServiceShift.update({
      where: { id: params.id },
      data,
      select: { id: true, status: true, startsAt: true, endsAt: true, capacity: true, notes: true, opportunity: { select: { id: true, title: true, location: true, defaultRole: true, group: { select: { id: true, name: true } } } }, _count: { select: { assignments: true } } }
    });
    await logAudit({ activityType: "membership-service-shift-updated", summary: `Updated an event date for “${shift.opportunity.title}”.`, details: JSON.stringify({ shiftId: shift.id, status: shift.status }), actorId: user.id });
    return NextResponse.json({ shift });
  } catch (error) {
    if (error instanceof MembershipVolunteerInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update the event." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const shift = await db.membershipServiceShift.findUnique({ where: { id: params.id }, select: { id: true, opportunity: { select: { title: true } }, _count: { select: { assignments: true } } } });
    if (!shift) return NextResponse.json({ error: "Event date not found." }, { status: 404 });
    if (shift._count.assignments) return NextResponse.json({ error: "An event date with volunteer assignments cannot be deleted. Cancel it instead." }, { status: 409 });
    await db.membershipServiceShift.delete({ where: { id: params.id } });
    await logAudit({ activityType: "membership-service-shift-deleted", summary: `Deleted an event date for “${shift.opportunity.title}”.`, details: JSON.stringify({ shiftId: shift.id }), actorId: user.id });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete the event date." }, { status: 500 });
  }
}
