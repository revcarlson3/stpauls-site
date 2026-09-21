import { describe, expect, it } from "vitest";
import {
  normalizePreferredContactMethod,
  preferredContactMethodLabel,
  validateHouseholdRoleChange
} from "@/lib/membership-contact-preferences";

describe("membership contact preferences", () => {
  it("preserves the existing no-preference behavior for missing or invalid values", () => {
    expect(normalizePreferredContactMethod(undefined)).toBe("NO_PREFERENCE");
    expect(normalizePreferredContactMethod("carrier-pigeon")).toBe("NO_PREFERENCE");
    expect(normalizePreferredContactMethod("SMS")).toBe("SMS");
    expect(preferredContactMethodLabel("POSTAL_MAIL")).toBe("Postal mail");
  });
});

describe("household role validation", () => {
  it("prevents two heads of household in the same family", () => {
    expect(validateHouseholdRoleChange({
      individualId: "member-2",
      destinationFamilyId: "family-1",
      destinationRoleSlug: "head-of-household",
      destinationHeadId: "member-1"
    })).toBe("The selected family already has a Head of Household.");
  });

  it("requires an active source family to retain a head", () => {
    expect(validateHouseholdRoleChange({
      individualId: "member-1",
      currentFamilyId: "family-1",
      currentRoleSlug: "head-of-household",
      destinationFamilyId: "family-2",
      destinationRoleSlug: "spouse",
      sourceFamilyActive: true,
      sourceOtherHeadId: null
    })).toBe("Assign another Head of Household before changing this person's family or role.");
  });

  it("allows ordinary role changes and head transfers with a replacement", () => {
    expect(validateHouseholdRoleChange({
      individualId: "member-1",
      currentFamilyId: "family-1",
      currentRoleSlug: "head-of-household",
      destinationFamilyId: "family-2",
      destinationRoleSlug: "head-of-household",
      sourceFamilyActive: true,
      sourceOtherHeadId: "member-3"
    })).toBeNull();
  });
});
