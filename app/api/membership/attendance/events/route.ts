import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import {
  MembershipAttendanceInputError,
  MEMBERSHIP_EVENT_STATUSES,
  normalizeMembershipEventInput
} from "@/lib/membership-attendance";

async function authorize() {
  return authorizeVolunteerScheduling();
}

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const page = positiveInteger(url.searchParams.get("page"), 1, 100000);
    const pageSize = positiveInteger(url.searchParams.get("pageSize"), 25, 100);
    const search = url.searchParams.get("search")?.trim().slice(0, 120) ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "all";
    if (status !== "all" && !MEMBERSHIP_EVENT_STATUSES.includes(status as (typeof MEMBERSHIP_EVENT_STATUSES)[number])) {
      return NextResponse.json({ error: "Choose a valid event status." }, { status: 400 });
    }
    const where = {
      ...(status !== "all" ? { status: status as (typeof MEMBERSHIP_EVENT_STATUSES)[number] } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { category: { contains: search, mode: "insensitive" as const } }, { location: { contains: search, mode: "insensitive" as const } }] } : {})
    };
    const [allEvents, total] = await Promise.all([
      db.membershipEvent.findMany({
        where,
        orderBy: [{ startsAt: "asc" }, { title: "asc" }],
        select: { id: true, title: true, description: true, eventType: true, status: true, category: true, location: true, startsAt: true, endsAt: true, timeZone: true, visitorCount: true, createdAt: true, updatedAt: true, _count: { select: { attendance: true } } }
      }),
      db.membershipEvent.count({ where })
    ]);
    const now = Date.now();
    const events = allEvents.sort((a, b) => {
      const aTime = a.startsAt.getTime();
      const bTime = b.startsAt.getTime();
      const aPast = aTime <= now;
      const bPast = bTime <= now;
      if (aPast !== bPast) return aPast ? -1 : 1;
      return aPast ? bTime - aTime : aTime - bTime;
    }).slice((page - 1) * pageSize, page * pageSize);
    const eventIds = events.map((event) => event.id);
    const grouped = eventIds.length ? await db.membershipAttendanceRecord.groupBy({ by: ["eventId", "status"], where: { eventId: { in: eventIds } }, _count: { _all: true } }) : [];
    const counts = new Map<string, Record<string, number>>();
    grouped.forEach((row) => counts.set(row.eventId, { ...(counts.get(row.eventId) ?? {}), [row.status]: row._count._all }));
    return NextResponse.json({
      events: events.map(({ _count, ...event }) => ({ ...event, attendanceCount: _count.attendance, attendanceByStatus: counts.get(event.id) ?? {} })),
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load membership events." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const data = normalizeMembershipEventInput(await request.json());
    const event = await db.membershipEvent.create({
      data: { ...data, title: data.title!, startsAt: data.startsAt!, createdById: user.id },
      select: { id: true, title: true, description: true, eventType: true, status: true, category: true, location: true, startsAt: true, endsAt: true, timeZone: true, visitorCount: true, createdAt: true, updatedAt: true }
    });
    await logAudit({ activityType: "membership-event-created", summary: `Created membership event “${event.title}”.`, details: JSON.stringify({ eventId: event.id }), actorId: user.id });
    return NextResponse.json({ event: { ...event, attendanceCount: 0, attendanceByStatus: {} } }, { status: 201 });
  } catch (error) {
    if (error instanceof MembershipAttendanceInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to create membership event." }, { status: 500 });
  }
}
