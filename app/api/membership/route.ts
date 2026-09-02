import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const memberType = url.searchParams.get("memberType")?.trim() ?? "";
    const id = url.searchParams.get("id");
    const members = await db.membershipIndividual.findMany({
      where: {
        status: { not: "REMOVED" },
        ...(memberType ? { memberType: { slug: memberType } } : {}),
        ...(search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { family: { lastName: { contains: search, mode: "insensitive" } } }] } : {})
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { family: true, memberType: true, familyRole: true },
      take: 200
    });
    const selected = id ? members.find((member) => member.id === id) ?? null : members[0] ?? null;
    const types = await db.membershipMemberType.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
    return NextResponse.json({
      types,
      members: members.map((member) => ({ id: member.id, firstName: member.firstName, middleName: member.middleName, lastName: member.lastName, familyLastName: member.family.lastName, memberNumber: member.memberNumber, memberType: member.memberType.name, status: member.status })),
      selected
    });
  } catch {
    return NextResponse.json({ error: "Unable to load membership records." }, { status: 403 });
  }
}
