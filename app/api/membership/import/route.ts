import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { estimateGradeLevel } from "@/lib/membership-grade-levels";
import {
  createMembershipImportPreview,
  MAX_MEMBERSHIP_IMPORT_BYTES,
  type MembershipImportContext,
  type MembershipImportMapping,
  type PreparedMembershipImportRow
} from "@/lib/membership-import";

type ImportDatabase = Pick<Prisma.TransactionClient, "membershipMemberType" | "membershipFamilyRole" | "membershipFamily" | "membershipIndividual" | "membershipCustomFieldDefinition">;

class ImportValidationError extends Error {}

async function loadImportContext(database: ImportDatabase): Promise<MembershipImportContext> {
  const [memberTypes, familyRoles, families, members, customFields] = await Promise.all([
    database.membershipMemberType.findMany({ select: { id: true, slug: true, name: true } }),
    database.membershipFamilyRole.findMany({ select: { id: true, slug: true, name: true } }),
    database.membershipFamily.findMany({
      where: { status: { not: "REMOVED" } },
      select: { id: true, lastName: true, addressStreet: true, addressCity: true, email: true, externalSource: true, externalKey: true }
    }),
    database.membershipIndividual.findMany({
      where: { status: { not: "REMOVED" } },
      select: {
        id: true,
        familyId: true,
        firstName: true,
        lastName: true,
        birthday: true,
        weddingDate: true,
        deceasedDate: true,
        email: true,
        externalSource: true,
        memberNumber: true,
        externalId: true,
        family: { select: { lastName: true } }
      }
    }),
    database.membershipCustomFieldDefinition.findMany({
      where: { isActive: true, appliesTo: { in: ["FAMILY", "INDIVIDUAL"] } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, type: true, appliesTo: true }
    })
  ]);
  return {
    memberTypes,
    familyRoles,
    families,
    members: members.map((member) => ({ ...member, birthday: member.birthday.toISOString(), weddingDate: member.weddingDate?.toISOString() ?? null, deceasedDate: member.deceasedDate?.toISOString() ?? null }))
    ,customFields: customFields.map((field) => ({ ...field, type: field.type as string, appliesTo: field.appliesTo as "FAMILY" | "INDIVIDUAL" }))
  };
}

function familyData(row: PreparedMembershipImportRow) {
  return {
    lastName: row.family.lastName,
    familyNameOverride: row.family.familyNameOverride,
    formalGreeting: row.family.formalGreeting,
    informalGreeting: row.family.informalGreeting,
    addressStreet: row.family.addressStreet,
    addressCity: row.family.addressCity,
    addressState: row.family.addressState,
    addressZip: row.family.addressZip,
    phone: row.family.phone,
    phoneIsMobile: row.family.phoneIsMobile,
    email: row.family.email
  };
}

function memberData(row: PreparedMembershipImportRow, familyId: string) {
  const birthday = new Date(`${row.member.birthday}T00:00:00.000Z`);
  return {
    familyId,
    firstName: row.member.firstName,
    middleName: row.member.middleName,
    lastName: row.member.lastName,
    birthday,
    weddingDate: row.member.weddingDate ? new Date(`${row.member.weddingDate}T00:00:00.000Z`) : null,
    deceasedDate: row.member.deceasedDate ? new Date(`${row.member.deceasedDate}T00:00:00.000Z`) : null,
    gender: row.member.gender,
    maritalStatus: row.member.maritalStatus,
    memberTypeId: row.member.memberTypeId,
    familyRoleId: row.member.familyRoleId,
    envelopeNumber: row.envelopeNumber,
    email: row.member.email,
    cellphone: row.member.cellphone,
    otherPhone: row.member.otherPhone,
    otherPhoneType: row.member.otherPhoneType,
    emailMessagesAllowed: row.member.emailMessagesAllowed,
    smsMessagesAllowed: row.member.smsMessagesAllowed,
    status: row.member.status,
    removedAt: null
  };
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  } catch {
    return NextResponse.json({ error: "You do not have permission to import membership records." }, { status: 403 });
  }

  try {
    let input: Record<string, unknown>;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
    }
    if (typeof input.action !== "string" || !["preview", "commit"].includes(input.action) || typeof input.csv !== "string") {
      return NextResponse.json({ error: "Provide an action of preview or commit and CSV text." }, { status: 400 });
    }
    const csv = input.csv;
    const sourceSystem = typeof input.sourceSystem === "string" && input.sourceSystem.trim() ? input.sourceSystem.trim().toLowerCase() : "generic";
    if (Buffer.byteLength(csv, "utf8") > MAX_MEMBERSHIP_IMPORT_BYTES) {
      return NextResponse.json({ error: "CSV imports are limited to 2 MB." }, { status: 413 });
    }

    if (input.action === "preview") {
      const preview = createMembershipImportPreview(csv, await loadImportContext(db), input.mapping as MembershipImportMapping | undefined, sourceSystem, input.valueMappings as { familyRole?: Record<string, string>; memberType?: Record<string, string> } | undefined);
      return NextResponse.json(preview, { status: preview.errors.length ? 400 : 200 });
    }
    if (typeof input.duplicateMode !== "string" || !["skip", "update", "create"].includes(input.duplicateMode)) {
      return NextResponse.json({ error: "duplicateMode must be skip, update, or create." }, { status: 400 });
    }
    const duplicateMode = input.duplicateMode as "skip" | "update" | "create";

    const result = await db.$transaction(async (transaction) => {
      const preview = createMembershipImportPreview(csv, await loadImportContext(transaction), input.mapping as MembershipImportMapping | undefined, sourceSystem, input.valueMappings as { familyRole?: Record<string, string>; memberType?: Record<string, string> } | undefined);
      if (preview.errors.length) throw new ImportValidationError(preview.errors.join(" "));
      const validRows = preview.rows.filter((row) => !row.errors.length);
      if (!validRows.length) throw new ImportValidationError("The CSV has no valid rows to import.");

      let nextMemberNumber = (await transaction.membershipIndividual.aggregate({ _max: { memberNumber: true } }))._max.memberNumber ?? 0;
      const familyIds = new Map<string, string>();
      const updatedFamilyIds = new Set<string>();
      const processedRowIds = new Map<number, string>();
      let familiesCreated = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of validRows) {
        if (row.duplicate && duplicateMode === "skip") {
          skipped += 1;
          continue;
        }

        const databaseDuplicate = row.duplicate?.source === "database" ? row.duplicate.candidates?.[0] : null;
        const csvDuplicateId = row.duplicate?.source === "csv" && row.duplicate.row ? processedRowIds.get(row.duplicate.row) : null;
        const updateId = duplicateMode === "update" ? databaseDuplicate?.id ?? csvDuplicateId ?? null : null;
        let familyId = familyIds.get(row.familyGroupKey)
          ?? row.existingFamilyId
          ?? databaseDuplicate?.familyId
          ?? null;

        if (!familyId) {
          const family = await transaction.membershipFamily.create({
            data: {
              ...familyData(row),
              churchId: user.churchId!,
              externalSource: sourceSystem,
              externalKey: row.familyGroupKey.startsWith("key:") ? row.familyGroupKey.slice(4) : null,
              status: row.member.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
            },
            select: { id: true }
          });
          familyId = family.id;
          familiesCreated += 1;
        } else if (duplicateMode === "update" && !updatedFamilyIds.has(familyId)) {
          await transaction.membershipFamily.update({
            where: { id: familyId },
            data: { ...familyData(row), externalSource: sourceSystem, externalKey: row.familyGroupKey.startsWith("key:") ? row.familyGroupKey.slice(4) : null, status: row.member.status === "INACTIVE" ? "INACTIVE" : "ACTIVE", removedAt: null }
          });
          updatedFamilyIds.add(familyId);
        }
        familyIds.set(row.familyGroupKey, familyId);

        let individualId: string;
        if (updateId) {
          const individual = await transaction.membershipIndividual.update({
            where: { id: updateId },
            data: { ...memberData(row, familyId), externalSource: sourceSystem, externalId: row.memberExternalId },
            select: { id: true }
          });
          individualId = individual.id;
          updated += 1;
        } else {
          nextMemberNumber += 1;
          const birthday = new Date(`${row.member.birthday}T00:00:00.000Z`);
          const individual = await transaction.membershipIndividual.create({
            data: {
              ...memberData(row, familyId),
              churchId: user.churchId!,
              externalSource: sourceSystem,
              externalId: row.memberExternalId,
              memberNumber: nextMemberNumber,
              gradeLevel: estimateGradeLevel(birthday)
            },
            select: { id: true }
          });
          individualId = individual.id;
          created += 1;
        }
        processedRowIds.set(row.row, individualId);
        for (const [targetAndDefinition, value] of Object.entries(row.customFields)) {
          const [target, definitionId] = targetAndDefinition.split(":");
          if (target === "FAMILY") {
            await transaction.membershipCustomFieldValue.upsert({
              where: { definitionId_familyId: { definitionId, familyId } },
              create: { definitionId, familyId, value },
              update: { value }
            });
          } else if (target === "INDIVIDUAL") {
            await transaction.membershipCustomFieldValue.upsert({
              where: { definitionId_individualId: { definitionId, individualId } },
              create: { definitionId, individualId, value },
              update: { value }
            });
          }
        }
      }

      const details = { rows: preview.summary.total, valid: validRows.length, invalid: preview.summary.invalid, duplicates: preview.summary.duplicates, duplicateMode, familiesCreated, created, updated, skipped };
      await transaction.auditLog.create({
        data: {
          activityType: "membership-import-committed",
          summary: `Imported ${created + updated} membership row${created + updated === 1 ? "" : "s"}.`,
          details: JSON.stringify(details),
          actorId: user.id
        }
      });
      return details;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Membership CSV import failed.", error);
    if (error instanceof ImportValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to import membership CSV." }, { status: 500 });
  }
}
