import { MembershipCustomFieldDefinition, MembershipCustomFieldType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const CUSTOM_FIELD_TARGETS = ["INDIVIDUAL", "FAMILY"] as const;

export class CustomFieldValidationError extends Error {}

type CustomFieldInput = Record<string, unknown>;

function optionsFor(definition: MembershipCustomFieldDefinition): string[] {
  return Array.isArray(definition.options)
    ? definition.options.filter((option): option is string => typeof option === "string")
    : [];
}

function normalizeValue(definition: MembershipCustomFieldDefinition, raw: unknown): string {
  if (definition.type !== MembershipCustomFieldType.CHECKBOX && typeof raw !== "string") {
    throw new CustomFieldValidationError(`The value for "${definition.name}" is invalid.`);
  }
  if (definition.type === MembershipCustomFieldType.CHECKBOX && typeof raw !== "boolean" && typeof raw !== "string") {
    throw new CustomFieldValidationError(`The value for "${definition.name}" is invalid.`);
  }
  const value = typeof raw === "boolean" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (value.length > 5000) throw new CustomFieldValidationError(`The value for "${definition.name}" is too long.`);
  if (value === "" && definition.type !== MembershipCustomFieldType.CHECKBOX) return value;

  switch (definition.type) {
    case MembershipCustomFieldType.CHECKBOX:
      if (value !== "true" && value !== "false") throw new CustomFieldValidationError(`The value for "${definition.name}" is invalid.`);
      return value;
    case MembershipCustomFieldType.SELECT:
    case MembershipCustomFieldType.RADIO:
      if (!optionsFor(definition).includes(value)) throw new CustomFieldValidationError(`Choose a valid option for "${definition.name}".`);
      return value;
    case MembershipCustomFieldType.DATE: {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CustomFieldValidationError(`Enter a valid date for "${definition.name}".`);
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CustomFieldValidationError(`Enter a valid date for "${definition.name}".`);
      return value;
    }
    case MembershipCustomFieldType.EMAIL:
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new CustomFieldValidationError(`Enter a valid email for "${definition.name}".`);
      return value.toLowerCase();
    case MembershipCustomFieldType.PHONE:
      if (value && !/^[0-9+().\-\s]{3,40}$/.test(value)) throw new CustomFieldValidationError(`Enter a valid phone number for "${definition.name}".`);
      return value;
    default:
      return value;
  }
}

export async function validateCustomFieldValues(raw: unknown, appliesTo: (typeof CUSTOM_FIELD_TARGETS)[number]) {
  if (raw !== undefined && (!raw || typeof raw !== "object" || Array.isArray(raw))) {
    throw new CustomFieldValidationError("Custom field values must be an object.");
  }
  const input: CustomFieldInput = (raw as CustomFieldInput | undefined) ?? {};
  const definitions = await db.membershipCustomFieldDefinition.findMany({
    where: { appliesTo, isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }]
  });
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const values: { definitionId: string; value: string }[] = [];

  for (const [definitionId, rawValue] of Object.entries(input)) {
    const definition = definitionById.get(definitionId);
    if (!definition) throw new CustomFieldValidationError("One or more custom fields are no longer available.");
    const value = normalizeValue(definition, rawValue);
    if (definition.isRequired && (value === "" || (definition.type === MembershipCustomFieldType.CHECKBOX && value !== "true"))) {
      throw new CustomFieldValidationError(`"${definition.name}" is required.`);
    }
    values.push({ definitionId, value });
  }

  for (const definition of definitions) {
    if (definition.isRequired && !values.some((entry) => entry.definitionId === definition.id)) {
      throw new CustomFieldValidationError(`"${definition.name}" is required.`);
    }
  }

  return { definitions, values };
}

type CustomFieldTransaction = Prisma.TransactionClient;

export async function saveCustomFieldValues(
  transaction: CustomFieldTransaction,
  target: "FAMILY" | "INDIVIDUAL",
  targetId: string,
  validated: Awaited<ReturnType<typeof validateCustomFieldValues>>
) {
  const suppliedIds = validated.values.map((entry) => entry.definitionId);
  const where = target === "FAMILY" ? { familyId: targetId } : { individualId: targetId };
  await transaction.membershipCustomFieldValue.deleteMany({
    where: { ...where, definitionId: { in: validated.definitions.map((definition) => definition.id).filter((id) => !suppliedIds.includes(id)) } }
  });

  for (const entry of validated.values) {
    if (target === "FAMILY") {
      await transaction.membershipCustomFieldValue.upsert({
        where: { definitionId_familyId: { definitionId: entry.definitionId, familyId: targetId } },
        create: { definitionId: entry.definitionId, familyId: targetId, value: entry.value },
        update: { value: entry.value }
      });
    } else {
      await transaction.membershipCustomFieldValue.upsert({
        where: { definitionId_individualId: { definitionId: entry.definitionId, individualId: targetId } },
        create: { definitionId: entry.definitionId, individualId: targetId, value: entry.value },
        update: { value: entry.value }
      });
    }
  }
}
