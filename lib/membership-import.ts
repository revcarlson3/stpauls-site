import { MARITAL_STATUSES } from "@/lib/modules";
import { normalizePhoneNumber } from "@/lib/phone-numbers";
import {
  parseMembershipCsv,
  resolveMembershipImportMapping
} from "@/lib/membership-import-fields";
import type { MembershipImportMapping } from "@/lib/membership-import-fields";

export {
  MEMBERSHIP_IMPORT_FIELDS,
  getDefaultMembershipImportMapping,
  parseMembershipCsv,
  resolveMembershipImportMapping,
  type MembershipImportField,
  type MembershipImportMapping
} from "@/lib/membership-import-fields";

export const MAX_MEMBERSHIP_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_MEMBERSHIP_IMPORT_ROWS = 5000;

export type MembershipImportReference = { id: string; slug: string; name: string };
export type MembershipImportExistingFamily = {
  id: string;
  lastName: string;
  addressStreet: string | null;
  addressCity: string | null;
  email: string | null;
  externalSource: string | null;
  externalKey: string | null;
};
export type MembershipImportExistingMember = {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string | null;
  birthday: string;
  weddingDate: string | null;
  deceasedDate: string | null;
  email: string | null;
  memberNumber: number;
  externalSource: string | null;
  externalId: string | null;
  family: { lastName: string };
};

export type MembershipImportContext = {
  memberTypes: MembershipImportReference[];
  familyRoles: MembershipImportReference[];
  families: MembershipImportExistingFamily[];
  members: MembershipImportExistingMember[];
  customFields: Array<{ id: string; name: string; slug: string; type?: string; appliesTo: "FAMILY" | "INDIVIDUAL" }>;
};
export type MembershipImportValueMappings = {
  familyRole?: Record<string, string>;
  memberType?: Record<string, string>;
};

export type MembershipImportDuplicate = {
  source: "database" | "csv";
  reason: string;
  row?: number;
  candidates?: Array<{ id: string; familyId: string; name: string; memberNumber: number }>;
};

export type PreparedMembershipImportRow = {
  row: number;
  familyGroupKey: string;
  family: {
    lastName: string;
    familyNameOverride: string | null;
    formalGreeting: string | null;
    informalGreeting: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
    phone: string | null;
    phoneIsMobile: boolean;
    email: string | null;
  };
  existingFamilyId: string | null;
  memberExternalId: string | null;
  customFields: Record<string, string>;
  envelopeNumber: string | null;
  member: {
    firstName: string;
    middleName: string | null;
    lastName: string | null;
    birthday: string;
    weddingDate: string | null;
    deceasedDate: string | null;
    gender: "MALE" | "FEMALE";
    maritalStatus: string;
    memberTypeId: string;
    memberType: string;
    familyRoleId: string;
    familyRole: string;
    email: string | null;
    cellphone: string | null;
    otherPhone: string | null;
    otherPhoneType: string | null;
    emailMessagesAllowed: boolean;
    smsMessagesAllowed: boolean;
    status: "ACTIVE" | "INACTIVE" | "DECEASED";
  };
  errors: string[];
  warnings: string[];
  duplicate: MembershipImportDuplicate | null;
};

export type MembershipImportPreview = {
  rows: PreparedMembershipImportRow[];
  summary: { total: number; valid: number; invalid: number; duplicates: number; warnings: number };
  errors: string[];
  warnings: string[];
  ignoredColumns: string[];
  availableFamilyRoles: MembershipImportReference[];
  availableMemberTypes: MembershipImportReference[];
  availableCustomFields: MembershipImportContext["customFields"];
};

function normalizedText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizedSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function optional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function familyLastNameFromImport(rawFamilyLastName: string | undefined, rawFamilyName: string | undefined) {
  const explicitLastName = optional(rawFamilyLastName);
  if (explicitLastName) return explicitLastName.replace(/\s+family$/i, "").trim();
  const familyName = optional(rawFamilyName);
  if (!familyName) return "";
  const commaIndex = familyName.indexOf(",");
  const commaSuffix = commaIndex >= 0 ? familyName.slice(commaIndex + 1).trim() : "";
  const isNameSuffix = /^(jr|sr|ii|iii|iv|v)\.?$/i.test(commaSuffix);
  const surname = commaIndex >= 0 && !isNameSuffix ? familyName.slice(0, commaIndex) : familyName;
  return surname.replace(/\s+family$/i, "").trim();
}

function parseDate(value: string | undefined): string | null {
  const originalText = value?.trim();
  if (!originalText) return null;
  const excelSerial = Number(originalText);
  if (/^\d+(?:\.\d+)?$/.test(originalText) && excelSerial >= 1 && excelSerial <= 2958465) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(excelSerial) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = originalText
    .replace(/T\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i, "")
    .replace(/\s+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s*[AP]M)?$/i, "")
    .trim();
  if (!text) return null;
  let year: number;
  let month: number;
  let day: number;
  const parseYear = (rawYear: string) => {
    const numericYear = Number(rawYear);
    return rawYear.length === 2 ? (numericYear >= 30 ? 1900 + numericYear : 2000 + numericYear) : numericYear;
  };
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = /^(\d{2})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (match) {
      year = parseYear(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
      if (match) {
          const first = Number(match[1]);
          const second = Number(match[2]);
          month = text.includes("-") ? second : first;
          day = text.includes("-") ? first : second;
          year = parseYear(match[3]);
          if (text.includes("-") && month > 12 && day <= 12) {
            [day, month] = [month, day];
          }
      } else {
        match = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})$/.exec(text);
        if (!match) return null;
        month = monthNames.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
        day = Number(match[1]);
        year = parseYear(match[3]);
        if (!month) return null;
      }
    }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseBoolean(value: string | undefined, errors: string[], label: string) {
  const text = normalizedText(value);
  if (!text) return false;
  if (["true", "yes", "y", "1", "on", "opted-in", "allowed"].includes(text)) return true;
  if (["false", "no", "n", "0", "off", "opted-out", "denied"].includes(text)) return false;
  errors.push(`${label} must be yes/no or true/false.`);
  return false;
}

function parseChurchTracAddressLine2(value: string | undefined) {
  const text = optional(value);
  if (!text) return null;
  const match = /^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(text);
  if (!match) return null;
  return { city: match[1].trim(), state: match[2].toUpperCase(), zip: match[3] };
}

function parseGender(value: string | undefined): "MALE" | "FEMALE" | null {
  const text = normalizedText(value);
  if (text === "male" || text === "m") return "MALE";
  if (text === "female" || text === "f") return "FEMALE";
  return null;
}

function parseStatus(value: string | undefined): "ACTIVE" | "INACTIVE" | "DECEASED" | null {
  const text = normalizedText(value) || "active";
  if (text === "active") return "ACTIVE";
  if (text === "inactive") return "INACTIVE";
  if (text === "deceased") return "DECEASED";
  return null;
}

function resolveReference(value: string | undefined, references: MembershipImportReference[]) {
  const text = normalizedText(value);
  const slug = normalizedSlug(value ?? "");
  return references.find((reference) => normalizedText(reference.name) === text || normalizedSlug(reference.slug) === slug) ?? null;
}

function validEmail(value: string | null) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function memberFingerprint(member: { firstName: string; lastName: string | null; birthday: string }, familyLastName: string) {
  return `${normalizedText(member.firstName)}|${normalizedText(member.lastName || familyLastName)}|${member.birthday}`;
}

function mergeFamilyRows(rawRows: Array<Record<string, string>>) {
  const families = new Map<string, Record<string, string>>();
  for (const raw of rawRows) {
    const key = optional(raw.familyKey);
    if (!key) continue;
    const normalizedKey = normalizedText(key);
    const current = families.get(normalizedKey) ?? {};
    for (const field of ["familyName", "familyLastName", "formalGreeting", "informalGreeting", "familyStreet", "familyAddressLine2", "familyCity", "familyState", "familyZip", "familyEmail", "familyPhone", "familyPhoneIsMobile"]) {
      if (!current[field] && raw[field]?.trim()) current[field] = raw[field];
    }
    families.set(normalizedKey, current);
  }
  return families;
}

export function createMembershipImportPreview(csv: string, context: MembershipImportContext, mapping?: MembershipImportMapping, sourceSystem = "generic", valueMappings?: MembershipImportValueMappings): MembershipImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: ReturnType<typeof parseMembershipCsv>;
  try {
    parsed = parseMembershipCsv(csv);
  } catch (error) {
    return { rows: [], summary: { total: 0, valid: 0, invalid: 0, duplicates: 0, warnings: 0 }, errors: [error instanceof Error ? error.message : "Unable to parse CSV."], warnings, ignoredColumns: [], availableFamilyRoles: context.familyRoles, availableMemberTypes: context.memberTypes, availableCustomFields: context.customFields };
  }
  if (!parsed.headers.length) {
    return { rows: [], summary: { total: 0, valid: 0, invalid: 0, duplicates: 0, warnings: 0 }, errors: ["The CSV is empty."], warnings, ignoredColumns: [], availableFamilyRoles: context.familyRoles, availableMemberTypes: context.memberTypes, availableCustomFields: context.customFields };
  }
  if (parsed.records.length > MAX_MEMBERSHIP_IMPORT_ROWS) {
    return { rows: [], summary: { total: parsed.records.length, valid: 0, invalid: parsed.records.length, duplicates: 0, warnings: 0 }, errors: [`CSV imports are limited to ${MAX_MEMBERSHIP_IMPORT_ROWS.toLocaleString()} data rows.`], warnings, ignoredColumns: [], availableFamilyRoles: context.familyRoles, availableMemberTypes: context.memberTypes, availableCustomFields: context.customFields };
  }

  const resolvedMapping = resolveMembershipImportMapping(parsed.headers, mapping, context.customFields.map((field) => field.id));
  const { mappedHeaders, ignoredColumns } = resolvedMapping;
  errors.push(...resolvedMapping.errors);
  if (resolvedMapping.errors.length) {
    return {
      rows: [],
      summary: { total: parsed.records.length, valid: 0, invalid: parsed.records.length, duplicates: 0, warnings: 0 },
      errors,
      warnings,
      ignoredColumns,
      availableFamilyRoles: context.familyRoles,
      availableMemberTypes: context.memberTypes,
      availableCustomFields: context.customFields
    };
  }
  if (ignoredColumns.length) warnings.push(`${mapping === undefined ? "Ignored unrecognized" : "Ignored/unmapped"} column(s): ${ignoredColumns.join(", ")}.`);

  const rawRows = parsed.records.map((record) => Object.fromEntries(record.values.map((value, index) => [mappedHeaders[index], value]).filter(([key]) => key)));
  const familyRows = mergeFamilyRows(rawRows);
  const seenEmails = new Map<string, number>();
  const seenPeople = new Map<string, number>();

  const rows = parsed.records.map((record, recordIndex): PreparedMembershipImportRow => {
    const ownRaw = rawRows[recordIndex];
    const raw = { ...ownRaw };
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];
    if (record.values.length !== parsed.headers.length) rowErrors.push(`Expected ${parsed.headers.length} columns but found ${record.values.length}.`);
    const familyKey = optional(raw.familyKey);
    const memberExternalId = optional(raw.memberExternalId);
    const customFields = Object.fromEntries(
      context.customFields
        .filter((field) => raw[`customField:${field.id}`]?.trim())
        .map((field) => {
          const rawValue = raw[`customField:${field.id}`].trim();
          const value = field.type === "DATE" ? parseDate(rawValue) ?? rawValue : rawValue;
          return [`${field.appliesTo}:${field.id}`, value];
        })
    );
    const envelopeNumber = optional(raw.envelopeNumber);
    if (familyKey) {
      const sharedFamily = familyRows.get(normalizedText(familyKey));
      for (const field of ["familyName", "familyLastName", "familyStreet", "familyAddressLine2", "familyCity", "familyState", "familyZip", "familyEmail", "familyPhone"]) {
        if (sharedFamily?.[field] && ownRaw[field] && normalizedText(sharedFamily[field]) !== normalizedText(ownRaw[field])) {
          rowErrors.push(`Family key "${familyKey}" has conflicting ${field} values.`);
        }
      }
      Object.assign(raw, sharedFamily, ownRaw);
    }
    if (sourceSystem === "churchtrac" && optional(raw.familyAddressLine2)) {
      const parsedAddress = parseChurchTracAddressLine2(raw.familyAddressLine2);
      if (parsedAddress) {
        raw.familyCity = optional(raw.familyCity) ?? parsedAddress.city;
        raw.familyState = optional(raw.familyState) ?? parsedAddress.state;
        raw.familyZip = optional(raw.familyZip) ?? parsedAddress.zip;
      } else {
        rowWarnings.push("ChurchTrac Address Line 2 could not be split into city, state, and ZIP. Map it manually or verify the source format.");
      }
    }
    const lastName = familyLastNameFromImport(raw.familyLastName, raw.familyName);
    const importedFamilyName = optional(raw.familyName);
    const familyNameHasHeadName = !optional(raw.familyLastName) && Boolean(importedFamilyName?.includes(","));
    if (!lastName) rowErrors.push("Family name or family last name is required.");
    if (!familyKey && !optional(raw.familyEmail) && !(optional(raw.familyStreet) && optional(raw.familyCity))) {
      rowWarnings.push("Add a family key or complete family contact details to improve household matching.");
    }

    const firstName = optional(raw.firstName) ?? "";
    if (!firstName) rowErrors.push("Member first name is required.");
    const birthday = parseDate(raw.birthday);
    if (!birthday) rowWarnings.push("Birthday is missing and should be completed later.");
    const weddingDate = optional(raw.weddingDate) ? parseDate(raw.weddingDate) : null;
    const deceasedDate = optional(raw.deceasedDate) ? parseDate(raw.deceasedDate) : null;
    if (optional(raw.weddingDate) && !weddingDate) rowErrors.push("Wedding date must be YYYY-MM-DD, YY-MM-DD, M/D/YYYY, or D-Mon-YY.");
    if (optional(raw.deceasedDate) && !deceasedDate) rowErrors.push("Deceased date must be YYYY-MM-DD, YY-MM-DD, M/D/YYYY, or D-Mon-YY.");
    const gender = parseGender(raw.gender);
    if (!gender) rowWarnings.push("Gender is missing and should be completed later.");
    const importedMaritalStatus = optional(raw.maritalStatus);
    const maritalStatus = importedMaritalStatus
      ? MARITAL_STATUSES.find((status) => normalizedText(status) === normalizedText(importedMaritalStatus)
        || (["widow/widower", "widow(er)"].includes(normalizedText(importedMaritalStatus)) && normalizedText(status) === "widowed"))
      : null;
    if (importedMaritalStatus && !maritalStatus) rowWarnings.push(`Marital status "${importedMaritalStatus}" needs review.`);
    const importedMemberType = optional(raw.memberType);
    const mappedMemberType = importedMemberType && valueMappings?.memberType?.[normalizedText(importedMemberType)]
      ? valueMappings.memberType[normalizedText(importedMemberType)]
      : importedMemberType;
    const memberType = resolveReference(mappedMemberType ?? undefined, context.memberTypes);
    if (!memberType) rowWarnings.push("Member type needs to be mapped to a configured type.");
    const importedFamilyRole = optional(raw.familyRole);
    const mappedFamilyRole = importedFamilyRole && valueMappings?.familyRole?.[normalizedText(importedFamilyRole)]
      ? valueMappings.familyRole[normalizedText(importedFamilyRole)]
      : importedFamilyRole;
    const familyRole = resolveReference(mappedFamilyRole ?? undefined, context.familyRoles);
    const resolvedFamilyRole = familyRole ?? (!optional(raw.familyRole)
      ? context.familyRoles.find((role) => role.slug === "other" || normalizedText(role.name) === "other") ?? null
      : null);
    if (!familyRole && resolvedFamilyRole) rowWarnings.push("Family role was blank and was assigned to Other for later review.");
    if (!resolvedFamilyRole) rowErrors.push("Family role must match a configured role name or slug.");
    const status = parseStatus(raw.status);
    if (!status) rowErrors.push("Status must be Active, Inactive, or Deceased.");

    const email = optional(raw.email)?.toLowerCase() ?? null;
    const familyEmail = optional(raw.familyEmail)?.toLowerCase() ?? null;
    if (!validEmail(email)) rowErrors.push("Member email is invalid.");
    if (!validEmail(familyEmail)) rowErrors.push("Family email is invalid.");
    const cellphone = normalizePhoneNumber(raw.cellphone);
    const otherPhone = normalizePhoneNumber(raw.otherPhone);
    const familyPhone = normalizePhoneNumber(raw.familyPhone);
    const familyPhoneIsMobile = parseBoolean(raw.familyPhoneIsMobile, rowErrors, "Family phone is mobile");
    const emailMessagesAllowed = parseBoolean(raw.emailConsent, rowErrors, "Email consent");
    const smsMessagesAllowed = parseBoolean(raw.smsConsent, rowErrors, "SMS consent");
    for (const [label, phone] of [["Member cellphone", cellphone], ["Other phone", otherPhone], ["Family phone", familyPhone]] as const) {
      if (phone && ![10, 11].includes(phone.length)) rowWarnings.push(`${label} has an unusual number of digits.`);
    }

    const hasCompleteAddress = Boolean(optional(raw.familyStreet) && optional(raw.familyCity));
    const familyGroupKey = familyKey
      ? `key:${normalizedText(familyKey)}`
      : familyEmail
        ? `email:${familyEmail}`
        : hasCompleteAddress
          ? `family:${normalizedText(lastName)}|${normalizedText(raw.familyStreet)}|${normalizedText(raw.familyCity)}`
          : `row:${record.row}`;
    const surnameMatches = context.families.filter((family) => normalizedText(family.lastName) === normalizedText(lastName));
    const matchingFamily = context.families.find((family) =>
      (family.externalSource === sourceSystem && family.externalKey && family.externalKey === familyKey)
      || (familyEmail && normalizedText(family.email) === familyEmail)
      || (lastName && optional(raw.familyStreet) && optional(raw.familyCity)
        && normalizedText(family.lastName) === normalizedText(lastName)
        && normalizedText(family.addressStreet) === normalizedText(raw.familyStreet)
        && normalizedText(family.addressCity) === normalizedText(raw.familyCity)))
      ?? (!familyEmail && !hasCompleteAddress && surnameMatches.length === 1 ? surnameMatches[0] : undefined);
    if (matchingFamily) rowWarnings.push(`Matched existing ${matchingFamily.lastName} family.`);

    const safeBirthday = birthday ?? "1900-01-01";
    const memberLastName = optional(raw.lastName);
    const fingerprint = memberFingerprint({ firstName, lastName: memberLastName, birthday: safeBirthday }, lastName);
    const databaseMatches = safeBirthday ? context.members.filter((member) =>
      (memberExternalId && member.externalSource === sourceSystem && member.externalId === memberExternalId)
      || (email && normalizedText(member.email) === email)
      || (normalizedText(member.firstName) === normalizedText(firstName)
        && memberFingerprint({ firstName: member.firstName, lastName: member.lastName, birthday: member.birthday.slice(0, 10) }, member.family.lastName) === fingerprint)) : [];
    let duplicate: MembershipImportDuplicate | null = null;
    if (databaseMatches.length) {
      duplicate = {
        source: "database",
        reason: email && databaseMatches.some((member) => normalizedText(member.email) === email) ? "Matching email" : "Matching name and birthday",
        candidates: databaseMatches.map((member) => ({ id: member.id, familyId: member.familyId, name: `${member.firstName} ${member.lastName ?? member.family.lastName}`, memberNumber: member.memberNumber }))
      };
      rowWarnings.push(`Possible existing member: ${duplicate.reason.toLowerCase()}.`);
      if (databaseMatches.length > 1) rowErrors.push("This row matches multiple existing members and cannot be imported automatically.");
    } else {
      const earlierEmailRow = email ? seenEmails.get(email) : undefined;
      const earlierPersonRow = safeBirthday ? seenPeople.get(fingerprint) : undefined;
      const earlierRow = earlierEmailRow ?? earlierPersonRow;
      if (earlierRow !== undefined) {
        duplicate = { source: "csv", reason: earlierEmailRow !== undefined ? "Repeated email in CSV" : "Repeated name and birthday in CSV", row: earlierRow };
        rowWarnings.push(`${duplicate.reason}; first seen on row ${earlierRow}.`);
      }
    }
    if (!rowErrors.length) {
      if (email && !seenEmails.has(email)) seenEmails.set(email, record.row);
      if (safeBirthday && !seenPeople.has(fingerprint)) seenPeople.set(fingerprint, record.row);
    }

    return {
      row: record.row,
      familyGroupKey,
      family: {
        lastName,
        familyNameOverride: importedFamilyName && !familyNameHasHeadName && normalizedText(importedFamilyName) !== normalizedText(lastName) ? importedFamilyName : null,
        formalGreeting: optional(raw.formalGreeting),
        informalGreeting: optional(raw.informalGreeting),
        addressStreet: optional(raw.familyStreet),
        addressCity: optional(raw.familyCity),
        addressState: optional(raw.familyState)?.toUpperCase() ?? null,
        addressZip: optional(raw.familyZip),
        phone: familyPhone,
        phoneIsMobile: familyPhoneIsMobile,
        email: familyEmail
      },
      existingFamilyId: matchingFamily?.id ?? null,
      memberExternalId,
      envelopeNumber,
      customFields,
      member: {
        firstName,
        middleName: optional(raw.middleName),
        lastName: memberLastName,
        birthday: safeBirthday,
        weddingDate,
        deceasedDate,
        gender: gender ?? "MALE",
        maritalStatus: maritalStatus ?? importedMaritalStatus ?? "",
        memberTypeId: memberType?.id ?? "",
        memberType: memberType?.name ?? mappedMemberType ?? "",
        familyRoleId: resolvedFamilyRole?.id ?? "",
        familyRole: resolvedFamilyRole?.name ?? mappedFamilyRole ?? "",
        email,
        cellphone,
        otherPhone,
        otherPhoneType: optional(raw.otherPhoneType),
        emailMessagesAllowed,
        smsMessagesAllowed,
        status: status ?? "ACTIVE"
      },
      errors: rowErrors,
      warnings: rowWarnings,
      duplicate
    };
  });

  const invalid = rows.filter((row) => row.errors.length).length;
  return {
    rows,
    summary: {
      total: rows.length,
      valid: rows.length - invalid,
      invalid,
      duplicates: rows.filter((row) => row.duplicate).length,
      warnings: rows.reduce((total, row) => total + row.warnings.length, warnings.length)
    },
    errors,
    warnings,
    ignoredColumns,
    availableFamilyRoles: context.familyRoles,
    availableMemberTypes: context.memberTypes,
    availableCustomFields: context.customFields
  };
}
