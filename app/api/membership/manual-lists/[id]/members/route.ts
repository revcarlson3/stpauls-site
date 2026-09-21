import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const sort = new URL(_.url).searchParams.get("sort") || "lastName";
    const orderBy = sort === "firstName" ? { individual: { firstName: "asc" as const } } : sort === "assignedAt" ? { assignedAt: "asc" as const } : { individual: { lastName: "asc" as const } };
    const list = await db.membershipManualList.findUnique({ where: { id: params.id }, select: { members: { orderBy, select: { assignedAt: true, individual: { select: { id: true, firstName: true, lastName: true, family: { select: { lastName: true } } } } } } } });
    if (!list) return NextResponse.json({ error: "Manual list not found." }, { status: 404 });
    return NextResponse.json({ members: list.members.map(({ individual }) => individual) });
  } catch {
    return NextResponse.json({ error: "Unable to load list members." }, { status: 403 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const input = await request.json();
    const memberIds: string[] = Array.from(new Set<string>((Array.isArray(input?.memberIds) ? input.memberIds : []).filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim())).map((id: string) => id.trim())));
    const list = await db.membershipManualList.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!list) return NextResponse.json({ error: "Manual list not found." }, { status: 404 });
    const valid = await db.membershipIndividual.findMany({ where: { id: { in: memberIds }, status: { not: "REMOVED" } }, select: { id: true } });
    await db.$transaction([
      db.membershipManualListMember.deleteMany({ where: { listId: params.id } }),
      db.membershipManualListMember.createMany({ data: valid.map(({ id }) => ({ listId: params.id, individualId: id })) })
    ]);
    return NextResponse.json({ saved: true, count: valid.length });
  } catch {
    return NextResponse.json({ error: "Unable to save list members." }, { status: 400 });
  }
}
