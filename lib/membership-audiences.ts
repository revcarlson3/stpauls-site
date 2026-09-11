import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AudienceType = "selected-members" | "volunteer-group" | "manual-list" | "dynamic-list" | "member-type";

export type DynamicCriteria = {
  conditions?: DynamicCondition[];
  match?: "all" | "any";
  memberTypeId?: string;
  memberTypeSlug?: string;
  status?: "ACTIVE" | "INACTIVE" | "DECEASED" | "REMOVED";
  emailConsent?: boolean;
  smsConsent?: boolean;
  city?: string;
  search?: string;
  sourceType?: "dynamic-list" | "volunteer-group" | "manual-list";
  sourceId?: string;
};

export type DynamicCondition = {
  field: string;
  operator: string;
  value: string;
};

export function audienceSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "list";
}

function cleanIds(value: unknown) {
  return Array.from(new Set(Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim())
    : []));
}

export function normalizeCriteria(input: unknown): DynamicCriteria {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const criteria: DynamicCriteria = {};
  if (Array.isArray(value.conditions)) {
    const conditions = value.conditions
      .filter((condition): condition is Record<string, unknown> => Boolean(condition) && typeof condition === "object" && !Array.isArray(condition))
      .map((condition) => ({
        field: typeof condition.field === "string" ? condition.field.trim().slice(0, 120) : "",
        operator: typeof condition.operator === "string" ? condition.operator.trim().slice(0, 40) : "",
        value: typeof condition.value === "string" ? condition.value.trim().slice(0, 200) : String(condition.value ?? "").slice(0, 200)
      }))
      .filter((condition) => condition.field && condition.operator && (condition.value || condition.operator === "isSet" || condition.operator === "isNotSet"));
    if (conditions.length) criteria.conditions = conditions;
    if (value.match === "any") criteria.match = "any";
  }
  if (typeof value.memberTypeId === "string" && value.memberTypeId.trim()) criteria.memberTypeId = value.memberTypeId.trim();
  if (typeof value.memberTypeSlug === "string" && value.memberTypeSlug.trim()) criteria.memberTypeSlug = value.memberTypeSlug.trim();
  if (["ACTIVE", "INACTIVE", "DECEASED", "REMOVED"].includes(String(value.status))) criteria.status = value.status as DynamicCriteria["status"];
  if (typeof value.emailConsent === "boolean") criteria.emailConsent = value.emailConsent;
  if (typeof value.smsConsent === "boolean") criteria.smsConsent = value.smsConsent;
  if (typeof value.city === "string" && value.city.trim()) criteria.city = value.city.trim().slice(0, 120);
  if (typeof value.search === "string" && value.search.trim()) criteria.search = value.search.trim().slice(0, 120);
  if (["dynamic-list", "volunteer-group", "manual-list"].includes(String(value.sourceType)) && typeof value.sourceId === "string" && value.sourceId.trim()) {
    criteria.sourceType = value.sourceType as DynamicCriteria["sourceType"];
    criteria.sourceId = value.sourceId.trim();
  }
  return criteria;
}

function legacyConditions(criteria: DynamicCriteria): DynamicCondition[] {
  const conditions: DynamicCondition[] = [];
  if (criteria.memberTypeId) conditions.push({ field: "memberType", operator: "equals", value: criteria.memberTypeId });
  if (criteria.status) conditions.push({ field: "status", operator: "equals", value: criteria.status });
  if (typeof criteria.emailConsent === "boolean") conditions.push({ field: "emailConsent", operator: "equals", value: String(criteria.emailConsent) });
  if (typeof criteria.smsConsent === "boolean") conditions.push({ field: "smsConsent", operator: "equals", value: String(criteria.smsConsent) });
  if (criteria.city) conditions.push({ field: "city", operator: "contains", value: criteria.city });
  if (criteria.search) conditions.push({ field: "search", operator: "contains", value: criteria.search });
  return conditions;
}

function conditionsFor(criteriaInput: unknown) {
  const criteria = normalizeCriteria(criteriaInput);
  return criteria.conditions ?? legacyConditions(criteria);
}

export function dynamicWhere(criteriaInput: unknown): Prisma.MembershipIndividualWhereInput {
  const criteria = normalizeCriteria(criteriaInput);
  const status = conditionsFor(criteria).find((condition) => condition.field === "status" && condition.operator === "equals")?.value;
  return {
    ...(status ? { status: status as DynamicCriteria["status"] } : { status: { not: "REMOVED" as const } })
  };
}

function databaseCondition(condition: DynamicCondition): Prisma.MembershipIndividualWhereInput | null {
  const { field, operator, value } = condition;
  if (field === "status" && operator === "equals") return { status: value as DynamicCriteria["status"] };
  if (field === "memberType" && operator === "equals") return { memberTypeId: value };
  if (field === "emailConsent" && operator === "equals" && ["true", "false"].includes(value)) return { emailMessagesAllowed: value === "true" };
  if (field === "smsConsent" && operator === "equals" && ["true", "false"].includes(value)) return { smsMessagesAllowed: value === "true" };
  if (field === "preferredContactMethod" && operator === "equals") return { preferredContactMethod: value };
  if (field === "doNotContact" && operator === "equals" && ["true", "false"].includes(value)) return { doNotContact: value === "true" };
  if ((field === "weddingDate" || field === "deceasedDate") && (operator === "isSet" || operator === "isNotSet")) {
    return { [field]: operator === "isSet" ? { not: null } : null };
  }
  if (field === "volunteerGroup" && (operator === "equals" || operator === "notEquals")) {
    const relation = { some: { groupId: value } };
    return operator === "equals" ? { volunteerGroups: relation } : { NOT: { volunteerGroups: relation } };
  }

  const stringFilter = operator === "equals"
    ? value ? { equals: value, mode: "insensitive" as const } : null
    : operator === "contains" ? { contains: value, mode: "insensitive" as const }
      : operator === "startsWith" ? { startsWith: value, mode: "insensitive" as const }
        : null;
  if (!stringFilter && !(operator === "equals" && !value)) return null;
  if (field === "firstName") return { firstName: stringFilter ?? { equals: "" } };
  if (field === "lastName" || field === "email") {
    if (!value) return { OR: [{ [field]: null }, { [field]: "" }] };
    return { [field]: stringFilter! };
  }
  if (field === "city") {
    if (!value) return { OR: [{ family: { addressCity: null } }, { family: { addressCity: "" } }] };
    return { family: { addressCity: stringFilter! } };
  }
  if (field === "search" && operator === "contains") {
    return {
      OR: [
        { firstName: stringFilter! },
        { lastName: stringFilter! },
        { email: stringFilter! },
        { family: { lastName: stringFilter! } }
      ]
    };
  }
  return null;
}

export function databaseDynamicWhere(criteriaInput: unknown): Prisma.MembershipIndividualWhereInput | null {
  const criteria = normalizeCriteria(criteriaInput);
  if (criteria.sourceType === "dynamic-list") return null;
  const conditions = conditionsFor(criteria);
  const compiled = conditions.map(databaseCondition);
  if (compiled.some((condition) => condition === null)) return null;
  const source = criteria.sourceType === "manual-list" && criteria.sourceId
    ? { manualLists: { some: { listId: criteria.sourceId } } }
    : criteria.sourceType === "volunteer-group" && criteria.sourceId
      ? { volunteerGroups: { some: { groupId: criteria.sourceId } } }
      : null;
  const conditionWhere = compiled.length
    ? criteria.match === "any" ? { OR: compiled as Prisma.MembershipIndividualWhereInput[] } : { AND: compiled as Prisma.MembershipIndividualWhereInput[] }
    : null;
  return {
    AND: [
      dynamicWhere(criteria),
      ...(conditionWhere ? [conditionWhere] : []),
      ...(source ? [source] : [])
    ]
  };
}

function compare(actual: string, operator: string, expected: string) {
  const left = actual.toLocaleLowerCase();
  const right = expected.toLocaleLowerCase();
  if (operator === "equals") return left === right;
  if (operator === "notEquals") return left !== right;
  if (operator === "contains") return left.includes(right);
  if (operator === "startsWith") return left.startsWith(right);
  if (operator === "greaterThan") return actual > expected;
  if (operator === "greaterOrEqual") return actual >= expected;
  if (operator === "lessThan") return actual < expected;
  if (operator === "lessOrEqual") return actual <= expected;
  return false;
}

function monthValue(value: string) {
  const match = value.match(/(?:^|-)(\d{2})(?:-|$)/);
  return match ? Number(match[1]) : Number.NaN;
}

type DynamicMember = {
  status: string;
  memberTypeId: string;
  emailMessagesAllowed: boolean;
  smsMessagesAllowed: boolean;
  preferredContactMethod: string;
  doNotContact: boolean;
  firstName: string;
  lastName: string | null;
  email: string | null;
  birthday: Date;
  weddingDate: Date | null;
  deceasedDate: Date | null;
  family: { addressCity: string | null; lastName: string | null; customValues: { definitionId: string; value: string }[] };
  customValues: { definitionId: string; value: string }[];
  volunteerGroups: { groupId: string }[];
};

function conditionValue(member: DynamicMember, condition: DynamicCondition) {
  if (condition.field === "status") return member.status;
  if (condition.field === "memberType") return member.memberTypeId;
  if (condition.field === "emailConsent") return String(member.emailMessagesAllowed);
  if (condition.field === "smsConsent") return String(member.smsMessagesAllowed);
  if (condition.field === "preferredContactMethod") return member.preferredContactMethod;
  if (condition.field === "doNotContact") return String(member.doNotContact);
  if (condition.field === "city") return member.family.addressCity ?? "";
  if (condition.field === "firstName") return member.firstName;
  if (condition.field === "lastName") return member.lastName ?? "";
  if (condition.field === "email") return member.email ?? "";
  if (condition.field === "search") return `${member.firstName} ${member.lastName ?? ""} ${member.family.lastName ?? ""} ${member.email ?? ""}`;
  if (condition.field === "birthdayMonth") return String(member.birthday.getUTCMonth() + 1).padStart(2, "0");
  if (condition.field === "weddingMonth") return member.weddingDate ? String(member.weddingDate.getUTCMonth() + 1).padStart(2, "0") : "";
  if (condition.field === "birthdayYear") return String(member.birthday.getUTCFullYear());
  if (condition.field === "weddingYear") return member.weddingDate ? String(member.weddingDate.getUTCFullYear()) : "";
  if (condition.field === "deceasedYear") return member.deceasedDate ? String(member.deceasedDate.getUTCFullYear()) : "";
  if (condition.field === "weddingDate") return member.weddingDate ? "true" : "false";
  if (condition.field === "deceasedDate") return member.deceasedDate ? "true" : "false";
  if (condition.field === "volunteerGroup") return member.volunteerGroups.map((group) => group.groupId).join(",");
  if (condition.field.startsWith("custom:")) {
    const definitionId = condition.field.slice(7);
    return member.customValues.find((entry) => entry.definitionId === definitionId)?.value
      ?? member.family.customValues.find((entry) => entry.definitionId === definitionId)?.value
      ?? "";
  }
  return "";
}

function matchesCondition(member: DynamicMember, condition: DynamicCondition) {
  const actual = conditionValue(member, condition);
  if (condition.operator === "isSet") return actual === "true";
  if (condition.operator === "isNotSet") return actual === "false";
  if (condition.field === "volunteerGroup" && (condition.operator === "equals" || condition.operator === "notEquals")) {
    const hasGroup = actual.split(",").includes(condition.value);
    return condition.operator === "equals" ? hasGroup : !hasGroup;
  }
  if (condition.operator.startsWith("month")) {
    const month = condition.field === "birthdayMonth" || condition.field === "weddingMonth" ? Number(actual) : monthValue(actual);
    const expected = Number(condition.value);
    if (!Number.isFinite(month) || !Number.isFinite(expected)) return false;
    const operator = condition.operator === "monthGreaterOrEqual" ? "greaterOrEqual" : condition.operator === "monthLessOrEqual" ? "lessOrEqual" : condition.operator === "monthEquals" ? "equals" : condition.operator;
    return compare(String(month).padStart(2, "0"), operator, String(expected).padStart(2, "0"));
  }
  const operator = condition.operator === "yearGreaterOrEqual" ? "greaterOrEqual" : condition.operator === "yearLessOrEqual" ? "lessOrEqual" : condition.operator;
  return compare(actual, operator, condition.value);
}

export async function dynamicMemberIds(criteriaInput: unknown) {
  const criteria = normalizeCriteria(criteriaInput);
  const conditions = conditionsFor(criteria);
  const members = await db.membershipIndividual.findMany({
    where: dynamicWhere(criteria),
    select: {
      id: true, status: true, memberTypeId: true, emailMessagesAllowed: true, smsMessagesAllowed: true, preferredContactMethod: true, doNotContact: true,
      firstName: true, lastName: true, email: true, birthday: true, weddingDate: true, deceasedDate: true,
      family: { select: { addressCity: true, lastName: true, customValues: { select: { definitionId: true, value: true } } } },
      customValues: { select: { definitionId: true, value: true } },
      volunteerGroups: { select: { groupId: true } }
    }
  });
  const matchingIds = members.filter((member) => {
    const checks = conditions.map((condition) => matchesCondition(member, condition));
    return criteria.match === "any" ? checks.some(Boolean) : checks.every(Boolean);
  }).map((member) => member.id);
  if (!criteria.sourceType || !criteria.sourceId) return matchingIds;
  let sourceIds: string[] = [];
  if (criteria.sourceType === "dynamic-list") {
    const list = await db.membershipDynamicList.findUnique({ where: { id: criteria.sourceId }, select: { criteria: true } });
    sourceIds = list ? await dynamicMemberIds(list.criteria) : [];
  } else if (criteria.sourceType === "manual-list") {
    const list = await db.membershipManualList.findUnique({ where: { id: criteria.sourceId }, select: { members: { select: { individualId: true } } } });
    sourceIds = list?.members.map((member) => member.individualId) ?? [];
  } else {
    const group = await db.membershipVolunteerGroup.findUnique({ where: { id: criteria.sourceId }, select: { members: { select: { individualId: true } } } });
    sourceIds = group?.members.map((member) => member.individualId) ?? [];
  }
  const sourceIdSet = new Set(sourceIds);
  return matchingIds.filter((id) => sourceIdSet.has(id));
}

export async function resolveAudienceMemberIds(type: AudienceType, value: unknown) {
  const ids = cleanIds(value);
  if (type === "selected-members") return ids;
  if (!["volunteer-group", "manual-list", "dynamic-list", "member-type"].includes(type)) return [];
  if (typeof value !== "string" || !value.trim()) return [];
  if (type === "volunteer-group") {
    const group = await db.membershipVolunteerGroup.findUnique({ where: { id: value }, select: { members: { select: { individualId: true } } } });
    return group?.members.map((member) => member.individualId) ?? [];
  }
  if (type === "manual-list") {
    const list = await db.membershipManualList.findUnique({ where: { id: value }, select: { members: { select: { individualId: true } } } });
    return list?.members.map((member) => member.individualId) ?? [];
  }
  if (type === "member-type") {
    const typeRecord = await db.membershipMemberType.findUnique({ where: { id: value }, select: { id: true } });
    if (!typeRecord) return [];
    const members = await db.membershipIndividual.findMany({ where: { memberTypeId: typeRecord.id }, select: { id: true } });
    return members.map((member) => member.id);
  }
  const list = await db.membershipDynamicList.findUnique({ where: { id: value }, select: { criteria: true } });
  if (!list) return [];
  return dynamicMemberIds(list.criteria);
}
