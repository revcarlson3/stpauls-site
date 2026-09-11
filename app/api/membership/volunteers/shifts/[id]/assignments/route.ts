import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import { MembershipVolunteerInputError, normalizeServiceAssignments } from "@/lib/membership-volunteers";

async function authorize() {
  return authorizeVolunteerScheduling();
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const shift = await db.membershipServiceShift.findUnique({
      where: { id: params.id },
      select: {
        id: true, startsAt: true, endsAt: true, status: true, capacity: true, notes: true,
        opportunity: {
          select: {
            id: true,
            title: true,
            defaultRole: true,
            location: true,
            group: { select: { id: true, name: true } },
            eventTeams: { select: { groupId: true, volunteersNeeded: true, group: { select: { id: true, name: true } } } }
          }
        }
      }
    });
    if (!shift) return NextResponse.json({ error: "Event date not found." }, { status: 404 });
    const eventTeams = shift.opportunity.eventTeams.length ? shift.opportunity.eventTeams : [{ groupId: shift.opportunity.group.id, volunteersNeeded: shift.capacity ?? 1, group: shift.opportunity.group }];
    const groupIds = eventTeams.map((team) => team.groupId);
    const members = await db.membershipIndividual.findMany({
      where: {
        OR: [
          { volunteerGroups: { some: { groupId: { in: groupIds } } }, status: { not: "REMOVED" } },
          { serviceAssignments: { some: { shiftId: shift.id } } }
        ]
      },
      orderBy: [{ family: { lastName: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, middleName: true, lastName: true, memberNumber: true, status: true,
        family: { select: { lastName: true } },
        volunteerGroups: { where: { groupId: { in: groupIds } }, select: { role: true, isLeader: true, assignedAt: true } },
        volunteerAssignmentHistory: { where: { groupId: { in: groupIds } }, orderBy: { createdAt: "desc" }, take: 1, select: { action: true, createdAt: true } },
        serviceAssignments: {
          where: { shiftId: shift.id },
          take: 1,
          select: { id: true, role: true, status: true, serviceRecord: { select: { outcome: true, minutesServed: true, notes: true, recordedAt: true } } }
        }
      }
    });
    return NextResponse.json({
      shift: { ...shift, opportunity: { ...shift.opportunity, eventTeams } },
      members: members.map(({ family, volunteerGroups, volunteerAssignmentHistory, serviceAssignments, ...member }) => ({
        ...member,
        familyLastName: family.lastName,
        groupMembership: volunteerGroups[0] ?? null,
        lastGroupAssignmentChange: volunteerAssignmentHistory[0] ?? null,
        assignment: serviceAssignments[0] ?? null
      }))
    });
  } catch {
    return NextResponse.json({ error: "Unable to load event volunteers." }, { status: 403 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const shift = await db.membershipServiceShift.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, capacity: true, opportunity: { select: { title: true, groupId: true, eventTeams: { select: { groupId: true } } } }, assignments: { select: { id: true, individualId: true, serviceRecord: { select: { id: true } } } } }
    });
    if (!shift) return NextResponse.json({ error: "Event date not found." }, { status: 404 });
    if (shift.status === "CANCELLED") return NextResponse.json({ error: "Assignments cannot be changed for a cancelled event." }, { status: 409 });
    const body = await request.json();
    const entries = normalizeServiceAssignments(body?.assignments);
    const memberIds = entries.map((entry) => entry.individualId);
    const groupIds = shift.opportunity.eventTeams.length ? shift.opportunity.eventTeams.map((team) => team.groupId) : [shift.opportunity.groupId];
    const currentGroupMembers = await db.membershipVolunteerGroupMember.findMany({
      where: { groupId: { in: groupIds }, individualId: { in: memberIds } },
      select: { individualId: true }
    });
    const allowedIds = new Set([...currentGroupMembers.map((member) => member.individualId), ...shift.assignments.map((assignment) => assignment.individualId)]);
    if (entries.some((entry) => entry.assigned && !allowedIds.has(entry.individualId))) {
      return NextResponse.json({ error: "New assignments must be current members of one of this event’s volunteer teams." }, { status: 409 });
    }
    const existingByMember = new Map(shift.assignments.map((assignment) => [assignment.individualId, assignment]));
    const finalAssigned = new Set(shift.assignments.map((assignment) => assignment.individualId));
    entries.forEach((entry) => entry.assigned ? finalAssigned.add(entry.individualId) : finalAssigned.delete(entry.individualId));
    if (shift.capacity !== null && finalAssigned.size > shift.capacity) return NextResponse.json({ error: `This event is limited to ${shift.capacity} volunteer${shift.capacity === 1 ? "" : "s"}.` }, { status: 409 });
    const protectedRemoval = entries.find((entry) => !entry.assigned && existingByMember.get(entry.individualId)?.serviceRecord);
    if (protectedRemoval) return NextResponse.json({ error: "Volunteers with recorded service history cannot be unassigned." }, { status: 409 });
    const clearedRecord = entries.find((entry) => entry.assigned && !entry.outcome && existingByMember.get(entry.individualId)?.serviceRecord);
    if (clearedRecord) return NextResponse.json({ error: "Recorded service history cannot be cleared. Change the outcome or notes instead." }, { status: 409 });

    await db.$transaction(async (transaction) => {
      for (const entry of entries) {
        if (!entry.assigned) {
          await transaction.membershipServiceAssignment.deleteMany({ where: { shiftId: shift.id, individualId: entry.individualId } });
          continue;
        }
        const assignment = await transaction.membershipServiceAssignment.upsert({
          where: { shiftId_individualId: { shiftId: shift.id, individualId: entry.individualId } },
          create: { shiftId: shift.id, individualId: entry.individualId, role: entry.role, status: entry.status },
          update: { role: entry.role, status: entry.status },
          select: { id: true }
        });
        if (entry.outcome) {
          await transaction.membershipServiceRecord.upsert({
            where: { assignmentId: assignment.id },
            create: { assignmentId: assignment.id, individualId: entry.individualId, outcome: entry.outcome, minutesServed: entry.minutesServed, notes: entry.notes, recordedById: user.id },
            update: { outcome: entry.outcome, minutesServed: entry.minutesServed, notes: entry.notes, recordedById: user.id, recordedAt: new Date() }
          });
        }
      }
    });
    const outcomesRecorded = entries.filter((entry) => entry.outcome).length;
    await logAudit({
      activityType: "membership-service-recorded",
      summary: `Updated ${entries.length} volunteer assignment${entries.length === 1 ? "" : "s"} for “${shift.opportunity.title}”.`,
      details: JSON.stringify({ shiftId: shift.id, individualIds: memberIds, outcomesRecorded }),
      actorId: user.id
    });
    return NextResponse.json({ saved: entries.length, outcomesRecorded, assignedCount: finalAssigned.size });
  } catch (error) {
    if (error instanceof MembershipVolunteerInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to save volunteer assignments." }, { status: 500 });
  }
}
