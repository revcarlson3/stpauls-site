import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const family = await db.membershipFamily.findUnique({ where: { id: params.id }, select: { id: true, lastName: true } });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });
    await db.$transaction([
      db.membershipIndividual.updateMany({ where: { familyId: params.id }, data: { status: "REMOVED", removedAt: new Date() } }),
      db.membershipFamily.update({ where: { id: params.id }, data: { status: "REMOVED", removedAt: new Date() } })
    ]);
    await logAudit({ activityType: "membership-family-removed", summary: `Removed membership family ${family.lastName}.`, actorId: user.id });
    return NextResponse.json({ removed: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove membership family." }, { status: 500 });
  }
}
