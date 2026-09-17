import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const links = await db.membershipEventVolunteerGroup.findMany({
      where: { eventId: params.id },
      orderBy: { group: { position: "asc" } },
      select: { group: { select: { id: true, name: true, members: { orderBy: { individual: { lastName: "asc" } }, select: { individual: { select: { id: true, firstName: true, lastName: true, family: { select: { lastName: true } } } } } } } } }
    });
    return NextResponse.json({ groups: links.map((link) => ({ id: link.group.id, name: link.group.name, members: link.group.members.map((member) => ({ id: member.individual.id, name: `${member.individual.lastName ?? member.individual.family.lastName}, ${member.individual.firstName}` })) })) });
  } catch {
    return NextResponse.json({ error: "Unable to load assigned volunteers." }, { status: 500 });
  }
}
