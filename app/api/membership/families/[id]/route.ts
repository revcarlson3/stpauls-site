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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
      const user = await requirePermission("MANAGE_MEMBERSHIP");
      await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
      const input = await request.json();
      if (!input || typeof input.lastName !== "string" || !input.lastName.trim() || typeof input.phone !== "string" || typeof input.email !== "string" || !["ACTIVE", "INACTIVE"].includes(input.status)) return NextResponse.json({ error: "Invalid family details." }, { status: 400 });
      if (input.status === "ACTIVE" && !(await db.membershipIndividual.findFirst({ where: { familyId: params.id, familyRole: { slug: "head-of-household" }, status: { not: "REMOVED" } }, select: { id: true } }))) return NextResponse.json({ error: "An active family must have a Head of Household." }, { status: 409 });
      const family = await db.membershipFamily.update({ where: { id: params.id }, data: { lastName: input.lastName.trim(), phone: input.phone.trim() || null, email: input.email.trim().toLowerCase() || null, status: input.status, formalGreeting: input.formalGreeting?.trim() || null, informalGreeting: input.informalGreeting?.trim() || null, addressStreet: input.addressStreet?.trim() || null, addressCity: input.addressCity?.trim() || null, addressState: input.addressState?.trim() || null, addressZip: input.addressZip?.trim() || null } });
      await logAudit({ activityType: "membership-family-updated", summary: `Updated membership family ${family.lastName}.`, actorId: user.id });
      return NextResponse.json({ family });
    } catch {
      return NextResponse.json({ error: "Unable to update membership family." }, { status: 500 });
  }
}
