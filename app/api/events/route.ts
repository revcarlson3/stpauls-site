import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";
import { logAudit } from "@/lib/audit";
import { buildRecurringDates } from "@/lib/event-scheduling";
import { requireTenantScope } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope(new URL(request.url).searchParams.get("churchId") || undefined);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const startsAt = from ? new Date(from) : new Date(new Date().getFullYear() - 1, 0, 1);
    const endsAt = to ? new Date(to) : new Date(new Date().getFullYear() + 2, 0, 1);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Invalid calendar range." }, { status: 400 });
    }
    const events = await db.membershipEvent.findMany({
      where: { churchId: scope.church.id, startsAt: { lt: endsAt }, OR: [{ endsAt: { gt: startsAt } }, { endsAt: null }] },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, description: true, eventType: true, status: true, category: true, location: true, readingsUrl: true, startsAt: true, endsAt: true, allDay: true, published: true, recurrenceGroupId: true, attendanceEnabled: true, attendanceAudienceType: true, attendanceAudienceId: true, timeZone: true }
    });
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "Unable to load events." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    const input = await request.json() as {
      title?: unknown;
      eventType?: unknown;
      category?: unknown;
      status?: unknown;
      timeZone?: unknown;
      description?: unknown;
      location?: unknown;
      readingsUrl?: unknown;
      startsAt?: unknown;
      endsAt?: unknown;
      allDay?: unknown;
      published?: unknown;
      attendanceEnabled?: unknown;
      attendanceAudienceType?: unknown;
      attendanceAudienceId?: unknown;
      recurrence?: { enabled?: unknown; frequency?: unknown; interval?: unknown; endMode?: unknown; endDate?: unknown; occurrences?: unknown };
    };
    const eventSettings = await db.membershipEventSettings.findUnique({ where: { id: 1 }, select: { eventTypes: true } });
    const eventTypes = Array.isArray(eventSettings?.eventTypes) ? eventSettings.eventTypes.filter((value): value is string => typeof value === "string") : ["Worship", "Class", "Fellowship", "Outreach", "Meeting", "Other"];
    if (
      typeof input.title !== "string" || !input.title.trim() ||
      (input.eventType !== undefined && !eventTypes.includes(String(input.eventType))) ||
      (input.status !== undefined && !["SCHEDULED", "COMPLETED", "CANCELLED"].includes(String(input.status))) ||
      (input.timeZone !== undefined && typeof input.timeZone !== "string") ||
      typeof input.startsAt !== "string" || Number.isNaN(new Date(input.startsAt).getTime()) ||
      (input.endsAt !== undefined && input.endsAt !== null && (typeof input.endsAt !== "string" || Number.isNaN(new Date(input.endsAt).getTime()))) ||
      (input.endsAt && new Date(input.endsAt as string) < new Date(input.startsAt)) ||
      (input.description !== undefined && input.description !== null && typeof input.description !== "string") ||
      (input.category !== undefined && input.category !== null && typeof input.category !== "string") ||
      (input.location !== undefined && input.location !== null && typeof input.location !== "string") ||
      (input.readingsUrl !== undefined && input.readingsUrl !== null && (typeof input.readingsUrl !== "string" || (input.readingsUrl.trim() && !/^https?:\/\/\S+$/i.test(input.readingsUrl.trim())))) ||
      typeof input.allDay !== "boolean" || typeof input.published !== "boolean" ||
      (input.attendanceEnabled !== undefined && typeof input.attendanceEnabled !== "boolean") ||
      (input.attendanceAudienceType !== undefined && input.attendanceAudienceType !== null && !["VOLUNTEER", "MANUAL", "DYNAMIC"].includes(String(input.attendanceAudienceType))) ||
      (input.attendanceAudienceId !== undefined && input.attendanceAudienceId !== null && typeof input.attendanceAudienceId !== "string") ||
      (input.recurrence?.enabled === true && (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(String(input.recurrence.frequency)) || typeof input.recurrence.interval !== "number" || !Number.isInteger(input.recurrence.interval) || input.recurrence.interval < 1 || input.recurrence.interval > 52 || !["DATE", "OCCURRENCES"].includes(String(input.recurrence.endMode)) || (input.recurrence.endMode === "DATE" && (typeof input.recurrence.endDate !== "string" || Number.isNaN(new Date(input.recurrence.endDate).getTime()))) || (input.recurrence.endMode === "OCCURRENCES" && (typeof input.recurrence.occurrences !== "number" || !Number.isInteger(input.recurrence.occurrences) || input.recurrence.occurrences < 2 || input.recurrence.occurrences > 365))))
    ) {
      return NextResponse.json({ error: "Enter a valid event name and date range." }, { status: 400 });
    }
    const start = new Date(input.startsAt);
    const end = input.endsAt ? new Date(input.endsAt as string) : null;
    const recurrence = input.recurrence?.enabled === true ? input.recurrence : null;
    const dates: Date[] = recurrence ? buildRecurringDates(start, {
      frequency: recurrence.frequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      interval: Number(recurrence.interval),
      endMode: recurrence.endMode as "DATE" | "OCCURRENCES",
      endDate: typeof recurrence.endDate === "string" ? recurrence.endDate : undefined,
      occurrences: typeof recurrence.occurrences === "number" ? recurrence.occurrences : undefined
    }) : [start];
    const recurrenceGroupId = recurrence ? crypto.randomUUID() : null;
    const duration = end ? end.getTime() - start.getTime() : 0;
    const title = input.title as string;
    const allDay = input.allDay as boolean;
    const published = input.published as boolean;
    await db.membershipEvent.createMany({
      data: dates.map((date) => ({
        churchId: scope.church.id,
        title: title.trim(),
        eventType: typeof input.eventType === "string" ? input.eventType : "Other",
        status: typeof input.status === "string" ? input.status as "SCHEDULED" | "COMPLETED" | "CANCELLED" : "SCHEDULED",
        timeZone: typeof input.timeZone === "string" ? input.timeZone : null,
        category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null,
        description: typeof input.description === "string" && input.description.trim() ? input.description.trim() : null,
        location: typeof input.location === "string" && input.location ? input.location : null,
        readingsUrl: typeof input.readingsUrl === "string" && input.readingsUrl.trim() ? input.readingsUrl.trim().slice(0, 500) : null,
        startsAt: date,
        endsAt: end ? new Date(date.getTime() + duration) : null,
        allDay,
        published,
        attendanceEnabled: input.attendanceEnabled === true,
        attendanceAudienceType: input.attendanceEnabled === true && typeof input.attendanceAudienceType === "string" ? input.attendanceAudienceType : null,
        attendanceAudienceId: input.attendanceEnabled === true && typeof input.attendanceAudienceId === "string" ? input.attendanceAudienceId : null,
        recurrenceGroupId,
        recurrenceRule: recurrence ? JSON.stringify(recurrence) : null,
        createdById: user.id
      }))
    });
    await logAudit({ activityType: "membership-event-created", summary: `Created ${dates.length} event${dates.length === 1 ? "" : "s"} for “${title.trim()}”.`, details: JSON.stringify({ recurrenceGroupId, eventCount: dates.length }), actorId: user.id });
    return NextResponse.json({ created: dates.length, recurrenceGroupId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create event." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const input = await request.json() as { id?: unknown; applyToSeries?: unknown; title?: unknown; eventType?: unknown; category?: unknown; status?: unknown; timeZone?: unknown; description?: unknown; location?: unknown; readingsUrl?: unknown; startsAt?: unknown; endsAt?: unknown; allDay?: unknown; published?: unknown; attendanceEnabled?: unknown; attendanceAudienceType?: unknown; attendanceAudienceId?: unknown };
    const eventSettings = await db.membershipEventSettings.findUnique({ where: { id: 1 }, select: { eventTypes: true } });
    const eventTypes = Array.isArray(eventSettings?.eventTypes) ? eventSettings.eventTypes.filter((value): value is string => typeof value === "string") : ["Worship", "Class", "Fellowship", "Outreach", "Meeting", "Other"];
    if (
      typeof input.id !== "string" || !input.id ||
      typeof input.title !== "string" || !input.title.trim() ||
      typeof input.eventType !== "string" || !eventTypes.includes(input.eventType) ||
      !["SCHEDULED", "COMPLETED", "CANCELLED"].includes(String(input.status)) ||
      typeof input.timeZone !== "string" ||
      typeof input.startsAt !== "string" || Number.isNaN(new Date(input.startsAt).getTime()) ||
      typeof input.endsAt !== "string" || Number.isNaN(new Date(input.endsAt).getTime()) ||
      new Date(input.endsAt) < new Date(input.startsAt) ||
      (input.description !== null && typeof input.description !== "string") ||
      (input.category !== null && typeof input.category !== "string") ||
      (input.location !== null && typeof input.location !== "string") ||
      (input.readingsUrl !== undefined && input.readingsUrl !== null && typeof input.readingsUrl !== "string") ||
      (typeof input.readingsUrl === "string" && input.readingsUrl.trim() !== "" && !/^https?:\/\/\S+$/i.test(input.readingsUrl.trim())) ||
      typeof input.allDay !== "boolean" || typeof input.published !== "boolean" ||
      typeof input.attendanceEnabled !== "boolean" ||
      (input.attendanceAudienceType !== null && !["VOLUNTEER", "MANUAL", "DYNAMIC"].includes(String(input.attendanceAudienceType))) ||
      (input.attendanceAudienceId !== null && typeof input.attendanceAudienceId !== "string")
    ) {
      return NextResponse.json({ error: "Enter a valid event name and date range." }, { status: 400 });
    }

    const current = await db.membershipEvent.findUnique({ where: { id: input.id }, select: { id: true, title: true, startsAt: true, endsAt: true, recurrenceGroupId: true } });
    if (!current) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const targetEvents = input.applyToSeries === true && current.recurrenceGroupId
      ? await db.membershipEvent.findMany({ where: { recurrenceGroupId: current.recurrenceGroupId }, select: { id: true, startsAt: true, endsAt: true } })
      : [current];
    const requestedStart = new Date(input.startsAt);
    const requestedEnd = new Date(input.endsAt);
    const data = {
        title: input.title.trim(),
        eventType: input.eventType,
        status: input.status as "SCHEDULED" | "COMPLETED" | "CANCELLED",
        timeZone: input.timeZone,
        category: input.category && input.category.trim() ? input.category.trim() : null,
        description: input.description && input.description.trim() ? input.description.trim() : null,
        location: input.location && input.location.trim() ? input.location.trim() : null,
        readingsUrl: input.readingsUrl && input.readingsUrl.trim() ? input.readingsUrl.trim().slice(0, 500) : null,
        startsAt: requestedStart,
        endsAt: requestedEnd,
        allDay: input.allDay,
        published: input.published,
        attendanceEnabled: input.attendanceEnabled,
        attendanceAudienceType: input.attendanceEnabled ? input.attendanceAudienceType as string : null,
        attendanceAudienceId: input.attendanceEnabled ? input.attendanceAudienceId as string : null
      };
    await db.$transaction(targetEvents.map((target) => db.membershipEvent.update({
      where: { id: target.id },
      data: input.applyToSeries === true && current.recurrenceGroupId ? {
        ...data,
        startsAt: new Date(target.startsAt.getTime() + (requestedStart.getTime() - current.startsAt.getTime())),
        endsAt: target.endsAt ? new Date(target.endsAt.getTime() + (requestedEnd.getTime() - (current.endsAt?.getTime() ?? current.startsAt.getTime()))) : requestedEnd
      } : data,
      select: { id: true }
    })));
    await logAudit({ activityType: "membership-event-updated", summary: `Updated ${targetEvents.length} event${targetEvents.length === 1 ? "" : "s"} for “${input.title.trim()}”.`, details: JSON.stringify({ eventId: input.id, recurrenceGroupId: current.recurrenceGroupId, series: targetEvents.length > 1, eventCount: targetEvents.length }), actorId: user.id });
    return NextResponse.json({ event: { id: input.id }, updated: targetEvents.length });
  } catch {
    return NextResponse.json({ error: "Unable to update event." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const series = searchParams.get("series") === "true";
    if (!id) return NextResponse.json({ error: "An event is required." }, { status: 400 });
    const event = await db.membershipEvent.findUnique({ where: { id }, select: { recurrenceGroupId: true } });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const result = series && event.recurrenceGroupId
      ? await db.membershipEvent.deleteMany({ where: { recurrenceGroupId: event.recurrenceGroupId } })
      : await db.membershipEvent.deleteMany({ where: { id } });
    await logAudit({ activityType: "membership-event-deleted", summary: `Deleted ${result.count} event${result.count === 1 ? "" : "s"} from the schedule.`, details: JSON.stringify({ eventId: id, recurrenceGroupId: event.recurrenceGroupId, series }), actorId: user.id });
    return NextResponse.json({ deleted: result.count });
  } catch {
    return NextResponse.json({ error: "Unable to delete event." }, { status: 500 });
  }
}
