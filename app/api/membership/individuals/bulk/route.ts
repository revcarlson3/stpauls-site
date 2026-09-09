import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const rawMemberIds: unknown[] = Array.isArray(input?.memberIds) ? input.memberIds : [];
    const memberIds: string[] = Array.from(new Set(rawMemberIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)));
    if (!memberIds.length || !["archive", "restore", "update"].includes(input.action)) {
      return NextResponse.json({ error: "Select at least one member and choose a valid action." }, { status: 400 });
    }
    if (input.action === "update") {
      const updates: { status?: "ACTIVE" | "INACTIVE" | "DECEASED"; memberTypeId?: string; familyRoleId?: string } = {};
      if (input.status !== undefined) {
        if (!["ACTIVE", "INACTIVE", "DECEASED"].includes(input.status)) return NextResponse.json({ error: "Invalid membership status." }, { status: 400 });
        updates.status = input.status;
      }
      if (input.memberTypeId !== undefined) {
        if (typeof input.memberTypeId !== "string" || !(await db.membershipMemberType.findUnique({ where: { id: input.memberTypeId }, select: { id: true } }))) return NextResponse.json({ error: "Invalid member type." }, { status: 400 });
        updates.memberTypeId = input.memberTypeId;
      }
      if (input.familyRoleId !== undefined) {
        if (typeof input.familyRoleId !== "string" || !(await db.membershipFamilyRole.findUnique({ where: { id: input.familyRoleId }, select: { id: true } }))) return NextResponse.json({ error: "Invalid family role." }, { status: 400 });
        updates.familyRoleId = input.familyRoleId;
      }
      if (!Object.keys(updates).length) return NextResponse.json({ error: "Choose at least one field to update." }, { status: 400 });
      const result = await db.membershipIndividual.updateMany({ where: { id: { in: memberIds }, status: { not: "REMOVED" } }, data: updates });
      if (!result.count) return NextResponse.json({ error: "No active members were found to update." }, { status: 404 });
      await logAudit({ activityType: "membership-individual-updated", summary: `Bulk updated ${result.count} membership individuals.`, actorId: user.id, details: `Requested member IDs: ${memberIds.join(", ")}` });
      return NextResponse.json({ updatedCount: result.count });
    }

    const restoring = input.action === "restore";
    const result = await db.membershipIndividual.updateMany({
      where: { id: { in: memberIds }, status: restoring ? "REMOVED" : { not: "REMOVED" } },
      data: restoring ? { status: "ACTIVE", removedAt: null } : { status: "REMOVED", removedAt: new Date() }
    });
    if (!result.count) return NextResponse.json({ error: `No ${restoring ? "archived" : "active"} members were found.` }, { status: 404 });
    await logAudit({
      activityType: restoring ? "membership-individual-updated" : "membership-individual-removed",
      summary: `${restoring ? "Restored" : "Archived"} ${result.count} membership individual${result.count === 1 ? "" : "s"}.`,
      actorId: user.id,
      details: `Requested member IDs: ${memberIds.join(", ")}`
    });
    return NextResponse.json({ updatedCount: result.count });
  } catch {
    return NextResponse.json({ error: "Unable to archive selected members." }, { status: 500 });
  }
}
