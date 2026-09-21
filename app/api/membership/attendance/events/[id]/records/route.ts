import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import { MembershipAttendanceInputError, normalizeAttendanceEntries } from "@/lib/membership-attendance";
import { requireTenantScope } from "@/lib/tenant";

async function authorize() {
  return authorizeVolunteerScheduling();
}

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const scope = await requireTenantScope();
    const event = await db.membershipEvent.findFirst({
      where: { id: params.id, churchId: scope.church.id },
      select: { id: true, title: true, startsAt: true, endsAt: true, status: true, eventType: true, location: true, visitorCount: true, attendanceAudienceType: true, attendanceAudienceId: true, volunteerGroups: { select: { groupId: true, group: { select: { name: true } } } } }
    });
    if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    const url = new URL(request.url);
    const page = positiveInteger(url.searchParams.get("page"), 1, 100000);
    const pageSize = positiveInteger(url.searchParams.get("pageSize"), 50, 100);
    const search = url.searchParams.get("search")?.trim().slice(0, 120) ?? "";
    const eventGroupIds = event.attendanceAudienceType === "VOLUNTEER" && event.attendanceAudienceId
      ? [event.attendanceAudienceId]
      : event.attendanceAudienceType ? [] : event.volunteerGroups.map((link) => link.groupId);
    const manualListId = event.attendanceAudienceType === "MANUAL" ? event.attendanceAudienceId : null;
    const manualList = manualListId ? await db.membershipManualList.findUnique({ where: { id: manualListId }, select: { name: true } }) : null;
    const audienceGroup = event.attendanceAudienceType === "VOLUNTEER" && event.attendanceAudienceId
      ? await db.membershipVolunteerGroup.findUnique({ where: { id: event.attendanceAudienceId }, select: { name: true } })
      : null;
    const linkedGroupNames = audienceGroup ? [audienceGroup.name] : event.volunteerGroups.filter((link) => eventGroupIds.includes(link.groupId)).map((link) => link.group.name);
    const rosterSource = event.attendanceAudienceType === "VOLUNTEER"
      ? { type: "VOLUNTEER_GROUP", label: `Linked volunteer group${linkedGroupNames[0] ? `: ${linkedGroupNames[0]}` : ""}` }
      : event.attendanceAudienceType === "MANUAL"
        ? { type: "MANUAL_AUDIENCE", label: `Explicit audience${manualList?.name ? `: ${manualList.name}` : ""}` }
        : event.attendanceAudienceType === "DYNAMIC"
          ? { type: "DYNAMIC_AUDIENCE", label: "Explicit dynamic audience" }
          : { type: "VOLUNTEER_GROUP", label: `Linked volunteer group${linkedGroupNames.length ? `: ${linkedGroupNames.join(", ")}` : ""}` };
    const rosterMembership = eventGroupIds.length
      ? [{ volunteerGroups: { some: { groupId: { in: eventGroupIds } } } }]
      : manualListId ? [{ manualLists: { some: { listId: manualListId } } }] : [];
    const memberWhere = {
      AND: [
        { OR: [...rosterMembership, { attendanceRecords: { some: { eventId: params.id } } }] },
        { status: { not: "REMOVED" as const } },
        ...(search ? [{ OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { family: { lastName: { contains: search, mode: "insensitive" as const } } }
        ] }] : [])
      ]
    };
    const [members, total, grouped] = await Promise.all([
      db.membershipIndividual.findMany({
        where: memberWhere,
        orderBy: [{ family: { lastName: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, firstName: true, middleName: true, lastName: true, memberNumber: true, status: true,
          family: { select: { lastName: true } },
          attendanceRecords: {
            where: { eventId: params.id },
            take: 1,
            select: { id: true, status: true, source: true, checkedInAt: true, minutesParticipated: true, notes: true, recordedAt: true, updatedAt: true }
          }
        }
      }),
      db.membershipIndividual.count({ where: memberWhere }),
      db.membershipAttendanceRecord.groupBy({ by: ["status"], where: { eventId: params.id }, _count: { _all: true } })
    ]);
    return NextResponse.json({
      event: { ...event, rosterSource },
      members: members.map(({ attendanceRecords, family, ...member }) => ({
        ...member,
        familyLastName: family.lastName,
        attendance: attendanceRecords[0] ?? null
      })),
      summary: {
        PRESENT: grouped.find((row) => row.status === "PRESENT")?._count._all ?? 0,
        ABSENT: grouped.find((row) => row.status === "ABSENT")?._count._all ?? 0,
        EXCUSED: grouped.find((row) => row.status === "EXCUSED")?._count._all ?? 0
      },
      visitorCount: event.visitorCount,
      attendanceGroupId: eventGroupIds[0] ?? manualListId,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load attendance records." }, { status: 403 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const scope = await requireTenantScope();
    const event = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { id: true, title: true, status: true } });
    if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    if (event.status === "CANCELLED") return NextResponse.json({ error: "Attendance cannot be changed for a cancelled event." }, { status: 409 });
    const body = await request.json();
    const visitorCount = body?.visitorCount === undefined ? undefined : Number(body.visitorCount);
    if (visitorCount !== undefined && (!Number.isInteger(visitorCount) || visitorCount < 0 || visitorCount > 100000)) {
      return NextResponse.json({ error: "Visitor count must be a whole number from 0 to 100000." }, { status: 400 });
    }
    const entries = Array.isArray(body?.records) && body.records.length ? normalizeAttendanceEntries(body.records) : [];
    const memberIds = entries.map((entry) => entry.individualId);
    const [members, existing] = await Promise.all([
      db.membershipIndividual.findMany({ where: { id: { in: memberIds }, churchId: scope.church.id }, select: { id: true } }),
      db.membershipAttendanceRecord.findMany({ where: { eventId: params.id, individualId: { in: memberIds } }, select: { id: true, individualId: true, status: true, checkedInAt: true } })
    ]);
    if (members.length !== memberIds.length) return NextResponse.json({ error: "One or more membership records no longer exist." }, { status: 409 });
    const existingByMember = new Map(existing.map((record) => [record.individualId, record]));
    const now = new Date();
    await db.$transaction(entries.map((entry) => {
      if (!entry.status) return db.membershipAttendanceRecord.deleteMany({ where: { eventId: params.id, individualId: entry.individualId } });
      const previous = existingByMember.get(entry.individualId);
      const checkedInAt = entry.status === "PRESENT" ? (previous?.status === "PRESENT" ? previous.checkedInAt : now) : null;
      return db.membershipAttendanceRecord.upsert({
        where: { eventId_individualId: { eventId: params.id, individualId: entry.individualId } },
        create: { eventId: params.id, individualId: entry.individualId, status: entry.status, source: "MANUAL", checkedInAt, minutesParticipated: entry.minutesParticipated, notes: entry.notes, recordedById: user.id },
        update: { status: entry.status, source: "MANUAL", checkedInAt, minutesParticipated: entry.minutesParticipated, notes: entry.notes, recordedById: user.id }
      });
    }));
    if (visitorCount !== undefined) await db.membershipEvent.update({ where: { id: params.id }, data: { visitorCount } });
    const removed = entries.filter((entry) => !entry.status && existingByMember.has(entry.individualId)).length;
    const saved = entries.filter((entry) => entry.status).length;
    await logAudit({
      activityType: "membership-attendance-recorded",
      summary: `Updated ${saved + removed} attendance record${saved + removed === 1 ? "" : "s"} for “${event.title}”.`,
      details: JSON.stringify({ eventId: event.id, saved, removed, individualIds: memberIds }),
      actorId: user.id
    });
    return NextResponse.json({ saved, removed });
  } catch (error) {
    if (error instanceof MembershipAttendanceInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to save attendance records." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const scope = await requireTenantScope();
    const individualId = new URL(request.url).searchParams.get("individualId")?.trim();
    if (!individualId) return NextResponse.json({ error: "Member is required." }, { status: 400 });
    const event = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { id: true, title: true, status: true } });
    if (!event) return NextResponse.json({ error: "Membership event not found." }, { status: 404 });
    if (event.status === "CANCELLED") return NextResponse.json({ error: "Attendance cannot be changed for a cancelled event." }, { status: 409 });
    const result = await db.membershipAttendanceRecord.deleteMany({ where: { eventId: params.id, individualId } });
    if (!result.count) return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    await logAudit({ activityType: "membership-attendance-recorded", summary: `Removed an attendance record from “${event.title}”.`, details: JSON.stringify({ eventId: event.id, individualId }), actorId: user.id });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to remove attendance record.");
  }
}
