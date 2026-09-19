import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { requireTenantScope } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorizeVolunteerScheduling();
    const scope = await requireTenantScope();
    const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) ?? "";
    if (search.length < 3) return NextResponse.json({ members: [] });
    const event = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { attendanceAudienceType: true, attendanceAudienceId: true } });
    if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    const groupId = event.attendanceAudienceType === "VOLUNTEER" ? event.attendanceAudienceId : null;
    const members = await db.membershipIndividual.findMany({
      where: {
        status: { not: "REMOVED" },
        lastName: { contains: search, mode: "insensitive" },
        churchId: scope.church.id,
        ...(groupId ? { volunteerGroups: { none: { groupId } } } : {})
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 20,
      select: { id: true, firstName: true, lastName: true, memberNumber: true, family: { select: { lastName: true } } }
    });
    return NextResponse.json({ members: members.map((member) => ({ ...member, familyLastName: member.family.lastName })) });
  } catch {
    return NextResponse.json({ error: "Unable to search the member directory." }, { status: 403 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
      const user = await authorizeVolunteerScheduling();
      const scope = await requireTenantScope();
      const input = await request.json();
      const individualId = typeof input?.individualId === "string" ? input.individualId.trim() : "";
      if (!individualId) return NextResponse.json({ error: "Member is required." }, { status: 400 });
      const event = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { id: true, status: true, attendanceAudienceType: true, attendanceAudienceId: true } });
      if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
      if (event.status === "CANCELLED") return NextResponse.json({ error: "Attendance cannot be changed for a cancelled event." }, { status: 409 });
      const individual = await db.membershipIndividual.findFirst({ where: { id: individualId, churchId: scope.church.id }, select: { id: true, status: true } });
      if (!individual || individual.status === "REMOVED") return NextResponse.json({ error: "Member not found." }, { status: 404 });
      const groupId = event.attendanceAudienceType === "VOLUNTEER" ? event.attendanceAudienceId : null;
      if (input?.addToGroup === true && groupId) {
        const group = await db.membershipVolunteerGroup.findFirst({ where: { id: groupId, churchId: scope.church.id }, select: { id: true } });
        if (!group) return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
        await db.membershipVolunteerGroupMember.upsert({
          where: { groupId_individualId: { groupId, individualId } },
          create: { groupId, individualId },
          update: {}
        });
      }
      await db.membershipAttendanceRecord.upsert({
        where: { eventId_individualId: { eventId: params.id, individualId } },
        create: { eventId: params.id, individualId, status: "PRESENT", source: "MANUAL", checkedInAt: new Date(), recordedById: user.id },
        update: { status: "PRESENT", source: "MANUAL", checkedInAt: new Date(), recordedById: user.id }
      });
      return NextResponse.json({ added: true });
    } catch (error) {
    return apiErrorResponse(error, "Unable to add member to attendance.");
  }
}
