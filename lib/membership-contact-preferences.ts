export const PREFERRED_CONTACT_METHODS = ["NO_PREFERENCE", "EMAIL", "SMS", "PHONE", "POSTAL_MAIL"] as const;

export type PreferredContactMethod = typeof PREFERRED_CONTACT_METHODS[number];

export const PREFERRED_CONTACT_METHOD_OPTIONS: Array<{ value: PreferredContactMethod; label: string }> = [
  { value: "NO_PREFERENCE", label: "No preference" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "Text message" },
  { value: "PHONE", label: "Phone call" },
  { value: "POSTAL_MAIL", label: "Postal mail" }
];

export function normalizePreferredContactMethod(value: unknown): PreferredContactMethod {
  return PREFERRED_CONTACT_METHODS.includes(value as PreferredContactMethod)
    ? value as PreferredContactMethod
    : "NO_PREFERENCE";
}

export function preferredContactMethodLabel(value: unknown) {
  const normalized = normalizePreferredContactMethod(value);
  return PREFERRED_CONTACT_METHOD_OPTIONS.find((option) => option.value === normalized)?.label ?? "No preference";
}

type HouseholdRoleChange = {
  individualId?: string;
  currentFamilyId?: string;
  currentRoleSlug?: string;
  destinationFamilyId: string;
  destinationRoleSlug: string;
  destinationHeadId?: string | null;
  sourceFamilyActive?: boolean;
  sourceOtherHeadId?: string | null;
};

export function validateHouseholdRoleChange(change: HouseholdRoleChange) {
  if (
    change.destinationRoleSlug === "head-of-household"
    && change.destinationHeadId
    && change.destinationHeadId !== change.individualId
  ) {
    return "The selected family already has a Head of Household.";
  }

  const leavesHeadRole = change.currentRoleSlug === "head-of-household"
    && (change.currentFamilyId !== change.destinationFamilyId || change.destinationRoleSlug !== "head-of-household");
  if (leavesHeadRole && change.sourceFamilyActive && !change.sourceOtherHeadId) {
    return "Assign another Head of Household before changing this person's family or role.";
  }

  return null;
}
