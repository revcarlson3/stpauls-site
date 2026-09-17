import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const rawMemberIds: unknown[] = Array.isArray(input?.memberIds) ? input.memberIds : [];
    const memberIds: string[] = Array.from(new Set(rawMemberIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)));
    if (!memberIds.length || !["archive", "restore", "update", "add-to-group"].includes(input.action)) {
      if (input.action === "add-to-group") {
        return NextResponse.json({ error: "Select at least one member and choose a group." }, { status: 400 });
      }
      return NextResponse.json({ error: "Select at least one member and choose a valid action." }, { status: 400 });
    }
    if (input.action === "add-to-group") {
      const audienceType = input.audienceType === "manual-list" ? "manual-list" : "volunteer-group";
      const groupId = typeof input.groupId === "string" ? input.groupId.trim() : "";
      if (!groupId) return NextResponse.json({ error: "Choose a group." }, { status: 400 });
      const group = audienceType === "manual-list"
        ? await db.membershipManualList.findUnique({ where: { id: groupId }, select: { id: true, name: true } })
        : await db.membershipVolunteerGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
      if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
      const activeMembers = await db.membershipIndividual.findMany({
        where: { id: { in: memberIds }, status: { not: "REMOVED" } },
        select: { id: true }
      });
      if (audienceType === "manual-list") {
        const result = await db.membershipManualListMember.createMany({
          data: activeMembers.map((member) => ({ listId: groupId, individualId: member.id })),
          skipDuplicates: true
        });
        return NextResponse.json({ updatedCount: result.count, alreadyAssigned: activeMembers.length - result.count, groupName: group.name });
      }
      const existing = await db.membershipVolunteerGroupMember.findMany({
        where: { groupId, individualId: { in: activeMembers.map((member) => member.id) } },
        select: { individualId: true }
      });
      const existingIds = new Set(existing.map((member) => member.individualId));
      const addedIds = activeMembers.map((member) => member.id).filter((id) => !existingIds.has(id));
      if (addedIds.length) {
        await db.$transaction([
          db.membershipVolunteerGroupMember.createMany({ data: addedIds.map((individualId) => ({ groupId, individualId })) }),
          ...addedIds.map((individualId) => db.membershipVolunteerAssignment.create({ data: { groupId, individualId, action: "ASSIGNED", changedById: user.id } }))
        ]);
        const orders = await db.membershipVolunteerRotationOrder.findMany({
          where: { groupId, isActive: true },
          include: { entries: { orderBy: { position: "desc" }, take: 1, select: { position: true } } }
        });
        for (const order of orders) {
          const orderMembers = await db.membershipVolunteerRotationEntry.findMany({ where: { orderId: order.id }, select: { individualId: true } });
          const orderIds = new Set(orderMembers.map((entry) => entry.individualId));
          const newIds = addedIds.filter((id) => !orderIds.has(id));
          if (newIds.length) {
            await db.membershipVolunteerRotationEntry.createMany({
              data: newIds.map((individualId, index) => ({ orderId: order.id, individualId, position: (order.entries[0]?.position ?? -1) + index + 1 }))
            });
          }
        }
      }
      return NextResponse.json({ updatedCount: addedIds.length, alreadyAssigned: activeMembers.length - addedIds.length, groupName: group.name });
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
        const role = typeof input.familyRoleId === "string"
          ? await db.membershipFamilyRole.findUnique({ where: { id: input.familyRoleId }, select: { id: true, slug: true } })
          : null;
        if (!role) return NextResponse.json({ error: "Invalid family role." }, { status: 400 });
        const selectedMembers = await db.membershipIndividual.findMany({
          where: { id: { in: memberIds }, status: { not: "REMOVED" } },
          select: { id: true, familyId: true, familyRole: { select: { slug: true } }, family: { select: { status: true } } }
        });
        const familyIds = Array.from(new Set(selectedMembers.map((member) => member.familyId)));
        const otherHeads = await db.membershipIndividual.findMany({
          where: { familyId: { in: familyIds }, id: { notIn: memberIds }, familyRole: { slug: "head-of-household" }, status: { not: "REMOVED" } },
          select: { familyId: true }
        });
        const familiesWithOtherHeads = new Set(otherHeads.map((member) => member.familyId));
        if (role.slug === "head-of-household") {
          const selectedPerFamily = new Map<string, number>();
          selectedMembers.forEach((member) => selectedPerFamily.set(member.familyId, (selectedPerFamily.get(member.familyId) ?? 0) + 1));
          if (selectedMembers.some((member) => familiesWithOtherHeads.has(member.familyId) || (selectedPerFamily.get(member.familyId) ?? 0) > 1)) {
            return NextResponse.json({ error: "Each family can have only one Head of Household. Update household roles individually." }, { status: 409 });
          }
        } else if (selectedMembers.some((member) => member.familyRole.slug === "head-of-household" && member.family.status === "ACTIVE" && !familiesWithOtherHeads.has(member.familyId))) {
          return NextResponse.json({ error: "An active family must retain a Head of Household. Update household roles individually." }, { status: 409 });
        }
        updates.familyRoleId = input.familyRoleId;
      }
      if (!Object.keys(updates).length) return NextResponse.json({ error: "Choose at least one field to update." }, { status: 400 });
      const before = await db.membershipIndividual.findMany({
        where: { id: { in: memberIds }, status: { not: "REMOVED" } },
        select: { id: true, status: true, memberTypeId: true, familyRoleId: true, removedAt: true }
      });
      const result = await db.$transaction(async (transaction) => {
        const result = await transaction.membershipIndividual.updateMany({ where: { id: { in: memberIds }, status: { not: "REMOVED" } }, data: updates });
        if (!result.count) return { count: 0, auditId: "" };
        const audit = await transaction.auditLog.create({
          data: {
            activityType: "membership-individual-updated",
            summary: `Bulk updated ${result.count} membership individuals.`,
            actorId: user.id,
            details: JSON.stringify({ kind: "bulk-reversible", memberIds: before.map((member) => member.id), before })
          }
        });
        return { count: result.count, auditId: audit.id };
      });
      if (!result.count) return NextResponse.json({ error: "No active members were found to update." }, { status: 404 });
      return NextResponse.json({ updatedCount: result.count, undoId: result.auditId });
    }

    const restoring = input.action === "restore";
    const before = await db.membershipIndividual.findMany({
      where: { id: { in: memberIds }, status: restoring ? "REMOVED" : { not: "REMOVED" } },
      select: { id: true, familyId: true, status: true, memberTypeId: true, familyRoleId: true, familyRole: { select: { slug: true } }, family: { select: { status: true } }, removedAt: true }
    });
    const result = await db.$transaction(async (transaction) => {
      const result = await transaction.membershipIndividual.updateMany({
        where: { id: { in: memberIds }, status: restoring ? "REMOVED" : { not: "REMOVED" } },
        data: restoring ? { status: "ACTIVE", removedAt: null } : { status: "REMOVED", removedAt: new Date() }
      });
      if (!result.count) return { count: 0, auditId: "" };
      const audit = await transaction.auditLog.create({
        data: {
          activityType: restoring ? "membership-individual-updated" : "membership-individual-removed",
          summary: `${restoring ? "Restored" : "Archived"} ${result.count} membership individual${result.count === 1 ? "" : "s"}.`,
          actorId: user.id,
          details: JSON.stringify({ kind: "bulk-reversible", memberIds: before.map((member) => member.id), before })
        },
        select: { id: true }
      });
      return { count: result.count, auditId: audit.id };
    });
    if (!result.count) return NextResponse.json({ error: `No ${restoring ? "archived" : "active"} members were found.` }, { status: 404 });
    return NextResponse.json({ updatedCount: result.count, undoId: result.auditId });
  } catch (error) {
    console.error("Bulk membership update failed.", error);
    return NextResponse.json({ error: "Unable to archive selected members." }, { status: 500 });
  }
}
