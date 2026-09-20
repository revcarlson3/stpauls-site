import { describe, expect, it } from "vitest";
import {
  createMembershipImportPreview,
  parseMembershipCsv,
  resolveMembershipImportMapping,
  type MembershipImportContext
} from "@/lib/membership-import";

const context: MembershipImportContext = {
  memberTypes: [{ id: "type-1", slug: "confirmed-member", name: "Confirmed Member" }],
  familyRoles: [
    { id: "role-1", slug: "head-of-household", name: "Head of Household" },
    { id: "role-other", slug: "other", name: "Other" }
  ],
  families: [],
  members: [],
  customFields: []
};

describe("membership CSV import", () => {
  it("parses quoted commas, escaped quotes, and multiline fields", () => {
    const parsed = parseMembershipCsv('family_name,first_name,formal_greeting\r\n"Smith, Jr.","Jane","Hello ""Smiths""\nWelcome"');
    expect(parsed.headers).toEqual(["family_name", "first_name", "formal_greeting"]);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].values).toEqual(["Smith, Jr.", "Jane", "Hello \"Smiths\"\nWelcome"]);
  });

  it("maps practical columns and resolves references by slug or case-insensitive name", () => {
    const preview = createMembershipImportPreview(
      "family_key,family_name,first_name,birthday,gender,marital_status,member_type,family_role,email_consent,sms_consent,cellphone\n"
      + "smith,Smith,Jane,1980-04-12,F,married,confirmed-member,HEAD OF HOUSEHOLD,yes,no,(320) 555-0101",
      context
    );
    expect(preview.errors).toEqual([]);
    expect(preview.summary).toMatchObject({ total: 1, valid: 1, invalid: 0 });
    expect(preview.rows[0].member).toMatchObject({
      gender: "FEMALE",
      maritalStatus: "Married",
      memberTypeId: "type-1",
      familyRoleId: "role-1",
      emailMessagesAllowed: true,
      smsMessagesAllowed: false,
      cellphone: "3205550101"
    });
  });

  it("parses ChurchTrac two-digit year dates", () => {
    const preview = createMembershipImportPreview(
      "family_name,first_name,birthday,wedding_date,deceased_date,gender,marital_status,member_type,family_role\n"
      + "Smith,Jane,98-10-16,05-06-01,,Female,Married,Confirmed Member,Head of Household",
      context,
      undefined,
      "churchtrac"
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].member).toMatchObject({
      birthday: "1998-10-16",
      weddingDate: "2005-06-01",
      deceasedDate: null
    });
  });

  it("normalizes day-month-name dates to ISO storage values", () => {
    const preview = createMembershipImportPreview(
      "family_name,first_name,birthday,wedding_date,deceased_date,gender,marital_status,member_type,family_role\n"
      + "Smith,Jane,16-Oct-98,1-Jun-05,2-Jan-20,Female,Married,Confirmed Member,Head of Household",
      context,
      undefined,
      "churchtrac"
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].member).toMatchObject({
      birthday: "1998-10-16",
      weddingDate: "2005-06-01",
      deceasedDate: "2020-01-02"
    });
  });

  it("normalizes spreadsheet date-times and Excel serial dates", () => {
    const preview = createMembershipImportPreview(
      "family_name,first_name,birthday,wedding_date,deceased_date,gender,marital_status,member_type,family_role\n"
      + "Smith,Jane,10/16/1998 12:00:00 AM,2005-06-01T00:00:00.000Z,45123,Female,Married,Confirmed Member,Head of Household",
      context
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].warnings).not.toContain("Birthday is missing and should be completed later.");
    expect(preview.rows[0].member).toMatchObject({
      birthday: "1998-10-16",
      weddingDate: "2005-06-01",
      deceasedDate: "2023-07-16"
    });
  });

  it("normalizes household values exported as last name comma head of household", () => {
    const preview = createMembershipImportPreview(
      "family_name,first_name,birthday,gender,marital_status,member_type,family_role\n"
      + '"Smith, Jane",Jane,1980-04-12,Female,Married,Confirmed Member,Head of Household',
      context
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].family.lastName).toBe("Smith");
    expect(preview.rows[0].family.familyNameOverride).toBeNull();
  });

  it("maps custom family and individual fields by definition", () => {
    const preview = createMembershipImportPreview(
      "family_name,first_name,birthday,gender,marital_status,member_type,family_role,anniversary,preferred_name\n"
      + "Smith,Jane,1980-04-12,Female,Married,Confirmed Member,Head of Household,2000-06-01,Janey",
      { ...context, customFields: [
        { id: "family-anniversary", slug: "anniversary", name: "Anniversary", appliesTo: "FAMILY" },
        { id: "individual-preferred", slug: "preferred-name", name: "Preferred name", appliesTo: "INDIVIDUAL" }
      ] },
      {
        "column:0": "familyName",
        "column:1": "firstName",
        "column:2": "birthday",
        "column:3": "gender",
        "column:4": "maritalStatus",
        "column:5": "memberType",
        "column:6": "familyRole",
        "column:7": "customField:family-anniversary",
        "column:8": "customField:individual-preferred"
      }
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].customFields).toEqual({
      "FAMILY:family-anniversary": "2000-06-01",
      "INDIVIDUAL:individual-preferred": "Janey"
    });
  });

  it("splits ChurchTrac address line 2 into city, state, and ZIP", () => {
    const preview = createMembershipImportPreview(
      "family_name,address_line_2,first_name,birthday,gender,marital_status,member_type,family_role\n"
      + "Smith,\"Milaca, MN 56353\",Jane,1980-04-12,Female,Married,Confirmed Member,Head of Household",
      context,
      undefined,
      "churchtrac"
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].family).toMatchObject({
      lastName: "Smith",
      addressCity: "Milaca",
      addressState: "MN",
      addressZip: "56353"
    });
  });

  it("maps ChurchTrac address line 1 into the family street address", () => {
      const preview = createMembershipImportPreview(
        "family_name,address_line_1,address_line_2,first_name,birthday,gender,marital_status,member_type,family_role\n"
        + "Smith,123 Main Street,\"Milaca, MN 56353\",Jane,1980-04-12,Female,Married,Confirmed Member,Head of Household",
        context,
        undefined,
        "churchtrac"
      );
      expect(preview.errors).toEqual([]);
      expect(preview.rows[0].family).toMatchObject({
        addressStreet: "123 Main Street",
        addressCity: "Milaca",
        addressState: "MN",
        addressZip: "56353"
    });
  });

  it("applies an explicit mapping before preview validation and ignores unmapped quoted columns", () => {
      const csv = [
        "Household,Given,DOB,Sex,Marriage,Kind,Position,Notes",
        '"Smith, Jr.",Jane,1980-04-12,F,Married,confirmed-member,head-of-household,"Keep, quoted safely"'
      ].join("\n");
      const preview = createMembershipImportPreview(csv, context, {
        "column:0": "familyName",
        "column:1": "firstName",
        "column:2": "birthday",
        "column:3": "gender",
        "column:4": "maritalStatus",
        "column:5": "memberType",
        "column:6": "familyRole",
        "column:7": "ignore"
      });

      expect(preview.errors).toEqual([]);
      expect(preview.ignoredColumns).toEqual(["Notes"]);
      expect(preview.rows[0].family.lastName).toBe("Smith, Jr.");
      expect(preview.rows[0].member.firstName).toBe("Jane");
  });

  it("preserves automatic alias mapping when an explicit mapping is omitted", () => {
      const resolved = resolveMembershipImportMapping(["family_name", "given_name", "member_number", "unused"]);
      expect(resolved.mappedHeaders).toEqual(["familyName", "firstName", "envelopeNumber", null]);
      expect(resolved.ignoredColumns).toEqual(["unused"]);
      expect(resolved.errors).toEqual([]);
  });

  it("rejects unknown sources, unsupported destinations, and duplicate assignments", () => {
      const resolved = resolveMembershipImportMapping(["First", "Preferred", "Extra"], {
        "column:0": "firstName",
        Preferred: "firstName",
        Missing: "birthday",
        "column:2": "notAField"
      });

      expect(resolved.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("both mapped to firstName"),
        expect.stringContaining("Missing"),
        expect.stringContaining("notAField")
      ]));
  });

  it("treats an explicitly ignored known alias as unmapped", () => {
      const resolved = resolveMembershipImportMapping(["first_name", "birthday"], {
        "column:0": "ignore",
        "column:1": "birthday"
      });
      expect(resolved.mappedHeaders).toEqual([null, "birthday"]);
      expect(resolved.ignoredColumns).toEqual(["first_name"]);
  });

  it("validates the mapping shape and prevents assigning one source twice", () => {
      expect(resolveMembershipImportMapping(["First"], [])).toMatchObject({
        errors: ["mapping must be an object."]
      });
      const resolved = resolveMembershipImportMapping(["First"], {
        First: "firstName",
        "column:0": "middleName"
      });
      expect(resolved.errors).toContain('CSV column "First" is assigned more than once in mapping.');
  });

  it("reports row validation failures and database and CSV duplicates", () => {
    const duplicateContext: MembershipImportContext = {
      ...context,
      members: [{
        id: "member-1",
        familyId: "family-1",
        firstName: "Jane",
        lastName: "Smith",
        birthday: "1980-04-12T00:00:00.000Z",
        weddingDate: null,
        deceasedDate: null,
        email: "jane@example.com",
        memberNumber: 12,
        externalSource: null,
        externalId: null,
        family: { lastName: "Smith" }
      }]
    };
    const headers = "family_key,family_name,first_name,last_name,birthday,gender,marital_status,member_type,family_role,email";
    const preview = createMembershipImportPreview(
      `${headers}\nsmith,Smith,Jane,Smith,4/12/1980,Female,Married,Confirmed Member,head-of-household,jane@example.com\n`
      + "smith,Smith,John,Smith,not-a-date,Male,Single,Unknown,head-of-household,john@example.com\n"
      + "smith,Smith,Jane,Smith,4/12/1980,Female,Married,Confirmed Member,head-of-household,new@example.com",
      duplicateContext
    );
    expect(preview.summary).toMatchObject({ total: 3, valid: 3, invalid: 0, duplicates: 2 });
    expect(preview.rows[0].duplicate).toMatchObject({ source: "database", reason: "Matching email" });
    expect(preview.rows[1].warnings).toContain("Birthday is missing and should be completed later.");
    expect(preview.rows[2].duplicate).toMatchObject({ source: "database", reason: "Matching name and birthday" });
  });

  it("groups rows by family key and reports conflicting family data", () => {
    const headers = "family_key,family_name,address_city,first_name,birthday,gender,marital_status,member_type,family_role";
    const preview = createMembershipImportPreview(
      `${headers}\nsmith,Smith,Milaca,Jane,1980-04-12,Female,Married,Confirmed Member,Head of Household\n`
      + "smith,Jones,Milaca,John,1981-05-13,Male,Married,Confirmed Member,Spouse",
      context
    );
    expect(preview.rows[0].familyGroupKey).toBe(preview.rows[1].familyGroupKey);
    expect(preview.rows[1].errors).toContain('Family key "smith" has conflicting familyName values.');
  });

  it("flags a repeated member within the same CSV", () => {
    const headers = "family_key,family_name,first_name,last_name,birthday,gender,marital_status,member_type,family_role,email";
    const row = "smith,Smith,Jane,Smith,1980-04-12,Female,Married,Confirmed Member,Head of Household,jane@example.com";
    const preview = createMembershipImportPreview(`${headers}\n${row}\n${row}`, context);
    expect(preview.rows[0].duplicate).toBeNull();
    expect(preview.rows[1].duplicate).toMatchObject({ source: "csv", row: 2 });
  });

  it("rejects unterminated quoted fields", () => {
    expect(() => parseMembershipCsv('first_name\n"Jane')).toThrow("unterminated quoted field");
  });
});
