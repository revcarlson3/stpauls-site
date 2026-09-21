import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    const event = await db.membershipEvent.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const links = await db.membershipEventVolunteerGroup.findMany({
      where: { eventId: params.id, group: { churchId: scope.church.id } },
      orderBy: { group: { position: "asc" } },
      select: { group: { select: { id: true, name: true, members: { orderBy: { individual: { lastName: "asc" } }, select: { individual: { select: { id: true, firstName: true, lastName: true, family: { select: { lastName: true } } } } } } } } }
    });
    return NextResponse.json({ groups: links.map((link) => ({ id: link.group.id, name: link.group.name, members: link.group.members.map((member) => ({ id: member.individual.id, name: `${member.individual.lastName ?? member.individual.family.lastName}, ${member.individual.firstName}` })) })) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load assigned volunteers.");
  }
}
