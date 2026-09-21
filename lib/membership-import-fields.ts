export const MEMBERSHIP_IMPORT_FIELDS = [
  { value: "familyKey", label: "Family key", aliases: ["familykey", "householdkey", "familyid", "householdid"] },
  { value: "memberExternalId", label: "Member external ID", aliases: ["memberid", "memberexternalid", "personid", "individualid", "contactid"] },
  { value: "envelopeNumber", label: "Envelope / giving number", aliases: ["membernumber", "memberno", "envelopenumber", "envelopeno", "givingnumber", "givingid", "stewardshipnumber"] },
  { value: "familyName", label: "Family name", aliases: ["familyname", "householdname"] },
  { value: "familyLastName", label: "Family last name", aliases: ["familylastname", "householdlastname"] },
  { value: "formalGreeting", label: "Formal greeting", aliases: ["formalgreeting", "familyformalgreeting"] },
  { value: "informalGreeting", label: "Informal greeting", aliases: ["informalgreeting", "familyinformalgreeting"] },
  { value: "familyStreet", label: "Family street address", aliases: ["familystreet", "addressstreet", "addressline1", "address1", "streetaddress", "street", "address", "familyaddress"] },
  { value: "familyAddressLine2", label: "Family address line 2", aliases: ["familyaddressline2", "addressline2", "address2", "addressline02"] },
  { value: "familyCity", label: "Family city", aliases: ["familycity", "addresscity", "city"] },
  { value: "familyState", label: "Family state", aliases: ["familystate", "addressstate", "state"] },
  { value: "familyZip", label: "Family ZIP / postal code", aliases: ["familyzip", "addresszip", "zip", "zipcode", "postalcode"] },
  { value: "familyEmail", label: "Family email", aliases: ["familyemail", "householdemail"] },
  { value: "familyPhone", label: "Family phone", aliases: ["familyphone", "householdphone", "homephone"] },
  { value: "familyPhoneIsMobile", label: "Family phone is mobile", aliases: ["familyphoneismobile", "familymobile", "householdphoneismobile"] },
  { value: "firstName", label: "Member first name", aliases: ["firstname", "memberfirstname", "givenname"] },
  { value: "middleName", label: "Member middle name", aliases: ["middlename", "membermiddlename"] },
  { value: "lastName", label: "Member last name", aliases: ["lastname", "memberlastname", "surname"] },
  { value: "birthday", label: "Birthday", aliases: ["birthday", "birthdate", "dateofbirth", "dob"] },
  { value: "weddingDate", label: "Wedding date", aliases: ["weddingdate", "marriagedate", "anniversarydate"] },
  { value: "deceasedDate", label: "Deceased date", aliases: ["deceaseddate", "dateofdeath", "deathdate", "dod"] },
  { value: "gender", label: "Gender", aliases: ["gender", "sex"] },
  { value: "maritalStatus", label: "Marital status", aliases: ["maritalstatus", "marital"] },
  { value: "memberType", label: "Member type", aliases: ["membertype", "membershiptype", "type"] },
  { value: "familyRole", label: "Family role", aliases: ["familyrole", "householdrole", "role"] },
  { value: "email", label: "Member email", aliases: ["email", "memberemail", "personalemail"] },
  { value: "cellphone", label: "Member cellphone", aliases: ["cellphone", "cell", "mobile", "mobilephone", "memberphone"] },
  { value: "otherPhone", label: "Other phone", aliases: ["otherphone", "alternatephone", "workphone"] },
  { value: "otherPhoneType", label: "Other phone type", aliases: ["otherphonetype", "alternatephonetype"] },
  { value: "emailConsent", label: "Email consent", aliases: ["emailconsent", "emailoptin", "emailmessagesallowed"] },
  { value: "smsConsent", label: "SMS consent", aliases: ["smsconsent", "smsoptin", "textconsent", "textoptin", "smsmessagesallowed"] },
  { value: "status", label: "Membership status", aliases: ["status", "memberstatus", "membershipstatus"] }
] as const;

export type MembershipImportField = (typeof MEMBERSHIP_IMPORT_FIELDS)[number]["value"];
export type MembershipImportDestination = MembershipImportField | `customField:${string}`;
export type MembershipImportMapping = Record<string, MembershipImportDestination | "ignore" | null>;
export type MembershipCsvRecord = { row: number; values: string[] };

const supportedFields = new Set<string>(MEMBERSHIP_IMPORT_FIELDS.map((field) => field.value));
const aliasLookup = new Map<string, MembershipImportField>(
  MEMBERSHIP_IMPORT_FIELDS.flatMap((field) => field.aliases.map((alias) => [alias, field.value]))
);

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseMembershipCsv(csv: string): { headers: string[]; records: MembershipCsvRecord[] } {
  const rows: MembershipCsvRecord[] = [];
  let values: string[] = [];
  let value = "";
  let quoted = false;
  let row = 1;
  let rowStart = 1;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === "\"") {
        if (csv[index + 1] === "\"") {
          value += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
        if (character === "\n") row += 1;
      }
      continue;
    }
    if (character === "\"" && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      values.push(value);
      value = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      values.push(value);
      if (values.some((entry) => entry.trim())) rows.push({ row: rowStart, values });
      values = [];
      value = "";
      row += 1;
      rowStart = row;
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error(`CSV row ${rowStart} has an unterminated quoted field.`);
  values.push(value);
  if (values.some((entry) => entry.trim())) rows.push({ row: rowStart, values });
  if (!rows.length) return { headers: [], records: [] };
  const [header, ...records] = rows;
  header.values[0] = header.values[0].replace(/^\uFEFF/, "");
  return { headers: header.values.map((entry) => entry.trim()), records };
}

export function getDefaultMembershipImportMapping(headers: string[], sourceSystem = "generic"): Array<MembershipImportField | null> {
  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    if (sourceSystem === "churchtrac" && normalized === "active") return "status";
    if (sourceSystem === "churchtrac" && normalized === "memberstatus") return "memberType";
    return aliasLookup.get(normalized) ?? null;
  });
}

function columnName(header: string, index: number) {
  return header || `Column ${index + 1}`;
}

export function resolveMembershipImportMapping(
  headers: string[],
  input?: unknown,
  customFieldIds: string[] = []
): { mappedHeaders: Array<MembershipImportField | `customField:${string}` | null>; ignoredColumns: string[]; errors: string[] } {
  const errors: string[] = [];
  const mappedHeaders: Array<MembershipImportField | `customField:${string}` | null> = input === undefined
    ? getDefaultMembershipImportMapping(headers)
    : headers.map(() => null);

  if (input !== undefined) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { mappedHeaders, ignoredColumns: headers.map(columnName), errors: ["mapping must be an object."] };
    }
    const assignedSources = new Set<number>();
    for (const [source, destination] of Object.entries(input)) {
      const indexMatch = /^column:(\d+)$/.exec(source);
      let index = indexMatch ? Number(indexMatch[1]) : -1;
      if (!indexMatch) {
        const matches = headers.flatMap((header, headerIndex) => header === source ? [headerIndex] : []);
        if (matches.length > 1) {
          errors.push(`Mapping source column "${source}" is ambiguous because the header is repeated.`);
          continue;
        }
        index = matches[0] ?? -1;
      }
      if (!Number.isInteger(index) || index < 0 || index >= headers.length) {
        errors.push(`Mapping source column "${source}" was not found in the CSV.`);
        continue;
      }
      if (assignedSources.has(index)) {
        errors.push(`CSV column "${columnName(headers[index], index)}" is assigned more than once in mapping.`);
        continue;
      }
      assignedSources.add(index);
      if (destination === null || destination === "ignore" || destination === "") continue;
      if (typeof destination !== "string" || (!supportedFields.has(destination) && !customFieldIds.includes(destination.replace(/^customField:/, "")))) {
        errors.push(`Mapping destination "${String(destination)}" is not supported.`);
        continue;
      }
      mappedHeaders[index] = destination as MembershipImportField | `customField:${string}`;
    }
  }

  const assigned = new Map<MembershipImportDestination, number>();
  for (let index = 0; index < mappedHeaders.length; index += 1) {
    const destination = mappedHeaders[index];
    if (!destination) continue;
    const earlierIndex = assigned.get(destination);
    if (earlierIndex !== undefined) {
      errors.push(`CSV columns "${columnName(headers[earlierIndex], earlierIndex)}" and "${columnName(headers[index], index)}" are both mapped to ${destination}.`);
    } else {
      assigned.set(destination, index);
    }
  }

  return {
    mappedHeaders,
    ignoredColumns: headers.flatMap((header, index) => mappedHeaders[index] ? [] : [columnName(header, index)]),
    errors
  };
}
