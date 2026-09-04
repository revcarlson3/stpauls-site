import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MARITAL_STATUSES } from "@/lib/modules";
import { CustomFieldValidationError, saveCustomFieldValues, validateCustomFieldValues } from "@/lib/membership-custom-fields";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    if (!input || typeof input.firstName !== "string" || !input.firstName.trim() || typeof input.familyId !== "string" || !["MALE", "FEMALE"].includes(input.gender) || !MARITAL_STATUSES.includes(input.maritalStatus) || !["ACTIVE", "INACTIVE", "DECEASED"].includes(input.status)) return NextResponse.json({ error: "Invalid individual details." }, { status: 400 });
    const customFields = Object.prototype.hasOwnProperty.call(input, "customFieldValues")
      ? await validateCustomFieldValues(input.customFieldValues, "INDIVIDUAL")
      : null;
    const birthday = new Date(input.birthday);
    if (Number.isNaN(birthday.getTime())) return NextResponse.json({ error: "A valid birthday is required." }, { status: 400 });
    const existing = await db.membershipIndividual.findUnique({ where: { id: params.id }, select: { id: true, familyId: true, familyRole: { select: { slug: true } } } });
    const family = await db.membershipFamily.findUnique({ where: { id: input.familyId }, select: { id: true, status: true } });
    if (!existing || !family || family.status === "REMOVED") return NextResponse.json({ error: "Individual or family not found." }, { status: 404 });
    if (existing.familyRole.slug === "head-of-household" && existing.familyId !== family.id) {
      const otherHead = await db.membershipIndividual.findFirst({ where: { familyId: family.id, familyRole: { slug: "head-of-household" }, status: { not: "REMOVED" } }, select: { id: true } });
      if (otherHead) return NextResponse.json({ error: "The destination family already has a Head of Household." }, { status: 409 });
      const sourceHead = await db.membershipIndividual.findFirst({ where: { familyId: existing.familyId, familyRole: { slug: "head-of-household" }, id: { not: existing.id }, status: { not: "REMOVED" } }, select: { id: true } });
      const sourceFamily = await db.membershipFamily.findUnique({ where: { id: existing.familyId }, select: { status: true } });
      if (!sourceHead && sourceFamily?.status === "ACTIVE") return NextResponse.json({ error: "Add another Head of Household before moving this person from an active family." }, { status: 409 });
    }
    const individual = await db.$transaction(async (transaction) => {
      const updated = await transaction.membershipIndividual.update({ where: { id: params.id }, data: {
        familyId: family.id, firstName: input.firstName.trim(), middleName: input.middleName?.trim() || null, lastName: input.lastName?.trim() || null, birthday, gender: input.gender, maritalStatus: input.maritalStatus, status: input.status, memberTypeId: input.memberTypeId, familyRoleId: input.familyRoleId, email: input.email?.trim().toLowerCase() || null, cellphone: input.cellphone?.trim() || null, weddingDate: input.weddingDate ? new Date(input.weddingDate) : null
      } });
      if (customFields) await saveCustomFieldValues(transaction, "INDIVIDUAL", params.id, customFields);
      return updated;
    });
    await logAudit({ activityType: "membership-individual-updated", summary: `Updated membership individual ${individual.firstName}.`, actorId: user.id });
    return NextResponse.json({ individual });
  } catch (error) {
    if (error instanceof CustomFieldValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update membership individual." }, { status: 500 });
  }
}
