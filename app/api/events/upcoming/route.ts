import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page") ?? "1"));
    const pageSize = 10;
    const where = { churchId: scope.church.id, startsAt: { gte: new Date() }, status: { not: "CANCELLED" as const } };
    const [events, total] = await Promise.all([
      db.membershipEvent.findMany({ where, orderBy: { startsAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, title: true, startsAt: true, endsAt: true, allDay: true, location: true, recurrenceGroupId: true, volunteerGroups: { select: { groupId: true, group: { select: { id: true, name: true } } } } } }),
      db.membershipEvent.count({ where })
    ]);
    return NextResponse.json({ events, page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load upcoming events.");
  }
}
