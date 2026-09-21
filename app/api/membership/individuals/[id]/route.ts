import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MARITAL_STATUSES } from "@/lib/modules";
import { CustomFieldValidationError, saveCustomFieldValues, validateCustomFieldValues } from "@/lib/membership-custom-fields";
import { normalizePhoneNumber } from "@/lib/phone-numbers";
import { membershipAuditDetails } from "@/lib/membership-timeline";
import { normalizePreferredContactMethod, PREFERRED_CONTACT_METHODS, validateHouseholdRoleChange } from "@/lib/membership-contact-preferences";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    if (!input || typeof input.firstName !== "string" || !input.firstName.trim() || typeof input.familyId !== "string" || typeof input.memberTypeId !== "string" || typeof input.familyRoleId !== "string" || !["MALE", "FEMALE"].includes(input.gender) || !MARITAL_STATUSES.includes(input.maritalStatus) || !["ACTIVE", "INACTIVE", "DECEASED"].includes(input.status)) return NextResponse.json({ error: "Invalid individual details." }, { status: 400 });
    if (!PREFERRED_CONTACT_METHODS.includes(input.preferredContactMethod ?? "NO_PREFERENCE") || (typeof input.communicationNotes === "string" && input.communicationNotes.length > 1000) || (typeof input.relationshipNotes === "string" && input.relationshipNotes.length > 500)) return NextResponse.json({ error: "Invalid contact preference or relationship notes." }, { status: 400 });
    const customFields = Object.prototype.hasOwnProperty.call(input, "customFieldValues")
      ? await validateCustomFieldValues(input.customFieldValues, "INDIVIDUAL")
      : null;
    const birthday = new Date(input.birthday);
    if (Number.isNaN(birthday.getTime())) return NextResponse.json({ error: "A valid birthday is required." }, { status: 400 });
    const [existing, family, role, type] = await Promise.all([
      db.membershipIndividual.findUnique({ where: { id: params.id }, select: { id: true, familyId: true, familyRole: { select: { slug: true } } } }),
      db.membershipFamily.findUnique({ where: { id: input.familyId }, select: { id: true, status: true } }),
      db.membershipFamilyRole.findUnique({ where: { id: input.familyRoleId }, select: { id: true, slug: true } }),
      db.membershipMemberType.findUnique({ where: { id: input.memberTypeId }, select: { id: true } })
    ]);
    if (!existing || !family || family.status === "REMOVED") return NextResponse.json({ error: "Individual or family not found." }, { status: 404 });
    if (!role || !type) return NextResponse.json({ error: "The selected membership type or family role is unavailable." }, { status: 400 });
    const [destinationHead, sourceOtherHead, sourceFamily] = await Promise.all([
      db.membershipIndividual.findFirst({ where: { familyId: family.id, familyRole: { slug: "head-of-household" }, status: { not: "REMOVED" } }, select: { id: true } }),
      db.membershipIndividual.findFirst({ where: { familyId: existing.familyId, familyRole: { slug: "head-of-household" }, id: { not: existing.id }, status: { not: "REMOVED" } }, select: { id: true } }),
      db.membershipFamily.findUnique({ where: { id: existing.familyId }, select: { status: true } })
    ]);
    const relationshipError = validateHouseholdRoleChange({
      individualId: existing.id,
      currentFamilyId: existing.familyId,
      currentRoleSlug: existing.familyRole.slug,
      destinationFamilyId: family.id,
      destinationRoleSlug: role.slug,
      destinationHeadId: destinationHead?.id,
      sourceFamilyActive: sourceFamily?.status === "ACTIVE",
      sourceOtherHeadId: sourceOtherHead?.id
    });
    if (relationshipError) return NextResponse.json({ error: relationshipError }, { status: 409 });
    const individual = await db.$transaction(async (transaction) => {
      const updated = await transaction.membershipIndividual.update({ where: { id: params.id }, data: {
        familyId: family.id, firstName: input.firstName.trim(), calledByName: input.calledByName?.trim() || null, middleName: input.middleName?.trim() || null, lastName: input.lastName?.trim() || null, envelopeNumber: typeof input.envelopeNumber === "string" ? input.envelopeNumber.trim() || null : null, birthday, ageCategoryOverride: input.ageCategoryOverride?.trim() || null, gender: input.gender, maritalStatus: input.maritalStatus, status: input.status, memberTypeId: type.id, familyRoleId: role.id, email: input.email?.trim().toLowerCase() || null, directoryListed: typeof input.directoryListed === "boolean" ? input.directoryListed : undefined, emailMessagesAllowed: typeof input.emailMessagesAllowed === "boolean" ? input.emailMessagesAllowed : undefined, smsMessagesAllowed: typeof input.smsMessagesAllowed === "boolean" ? input.smsMessagesAllowed : undefined, preferredContactMethod: normalizePreferredContactMethod(input.preferredContactMethod), doNotContact: typeof input.doNotContact === "boolean" ? input.doNotContact : undefined, communicationNotes: typeof input.communicationNotes === "string" ? input.communicationNotes.trim() || null : undefined, relationshipNotes: typeof input.relationshipNotes === "string" ? input.relationshipNotes.trim() || null : undefined, cellphone: normalizePhoneNumber(input.cellphone), otherPhone: input.otherPhone?.trim() || null, otherPhoneType: input.otherPhoneType?.trim() || null, gradeLevel: input.gradeLevel?.trim() || null, weddingDate: input.weddingDate ? new Date(input.weddingDate) : null, deceasedDate: input.deceasedDate ? new Date(input.deceasedDate) : null
      } });
      if (customFields) await saveCustomFieldValues(transaction, "INDIVIDUAL", params.id, customFields);
      return updated;
    });
    await logAudit({
      activityType: "membership-individual-updated",
      summary: `Updated membership individual ${individual.firstName}.`,
      details: membershipAuditDetails({ individualId: individual.id, familyId: individual.familyId }),
      actorId: user.id
    });
    return NextResponse.json({ individual });
  } catch (error) {
    if (error instanceof CustomFieldValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update membership individual." }, { status: 500 });
  }
}
