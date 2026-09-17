export const MEMBERSHIP_DASHBOARD_DATE_WINDOW_DAYS = 30;
export const MEMBERSHIP_DASHBOARD_ENGAGEMENT_DAYS = 90;
export const MEMBERSHIP_DASHBOARD_DETAIL_LIMIT = 8;
export const MEMBERSHIP_DASHBOARD_BLOCK_IDS = ["birthdays", "anniversaries", "profiles", "engagement", "volunteer"] as const;

export type MembershipDashboardBlockId = (typeof MEMBERSHIP_DASHBOARD_BLOCK_IDS)[number];
export type MembershipDashboardBlockWidth = "quarter" | "half" | "full";
export type MembershipDashboardLayout = {
  order: MembershipDashboardBlockId[];
  visible: Record<MembershipDashboardBlockId, boolean>;
  widths: Record<MembershipDashboardBlockId, MembershipDashboardBlockWidth>;
};

export const DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT: MembershipDashboardLayout = {
  order: [...MEMBERSHIP_DASHBOARD_BLOCK_IDS],
  visible: {
    birthdays: true,
    anniversaries: true,
    profiles: true,
    engagement: true,
    volunteer: true
  },
  widths: {
    birthdays: "half",
    anniversaries: "half",
    profiles: "half",
    engagement: "full",
    volunteer: "full"
  }
};

type ProfileFields = {
  email: string | null;
  cellphone: string | null;
  otherPhone: string | null;
  family: {
    email: string | null;
    phone: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
  };
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function annualDateKeys(start: Date, days: number) {
  const keys: string[] = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const date = new Date(start);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + offset);
    keys.push(`${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`);
  }
  return keys;
}

export function nextAnnualOccurrence(value: Date, today: Date) {
  const year = today.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const occurrence = new Date(Date.UTC(year, month, day));
  if (occurrence < new Date(Date.UTC(year, today.getUTCMonth(), today.getUTCDate()))) {
    occurrence.setUTCFullYear(year + 1);
  }
  return occurrence;
}

export function anniversaryYears(value: Date, occurrence: Date) {
  return Math.max(0, occurrence.getUTCFullYear() - value.getUTCFullYear());
}

export function missingProfileFields(profile: ProfileFields) {
  const missing: string[] = [];
  if (!hasText(profile.email) && !hasText(profile.family.email)) missing.push("email");
  if (!hasText(profile.cellphone) && !hasText(profile.otherPhone) && !hasText(profile.family.phone)) missing.push("phone");
  if (![profile.family.addressStreet, profile.family.addressCity, profile.family.addressState, profile.family.addressZip].every(hasText)) missing.push("address");
  return missing;
}

export function percentage(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

export function periodComparison(current: number, prior: number) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrior = Number.isFinite(prior) ? prior : 0;
  const change = safeCurrent - safePrior;
  return {
    current: safeCurrent,
    prior: safePrior,
    change,
    changePercent: safePrior === 0 ? null : Math.round((change / safePrior) * 100)
  };
}

export function normalizeDashboardLayout(input: unknown): MembershipDashboardLayout {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const requestedOrder = Array.isArray(value.order) ? value.order : [];
  const order = requestedOrder.filter(
    (id, index): id is MembershipDashboardBlockId =>
      typeof id === "string"
      && MEMBERSHIP_DASHBOARD_BLOCK_IDS.includes(id as MembershipDashboardBlockId)
      && requestedOrder.indexOf(id) === index
  );
  for (const id of MEMBERSHIP_DASHBOARD_BLOCK_IDS) {
    if (!order.includes(id)) order.push(id);
  }

  const requestedVisible = value.visible && typeof value.visible === "object" ? value.visible as Record<string, unknown> : {};
  const requestedWidths = value.widths && typeof value.widths === "object" ? value.widths as Record<string, unknown> : {};
  const visible = { ...DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT.visible };
  const widths = { ...DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT.widths };
  for (const id of MEMBERSHIP_DASHBOARD_BLOCK_IDS) {
    if (typeof requestedVisible[id] === "boolean") visible[id] = requestedVisible[id] as boolean;
    if (requestedWidths[id] === "quarter" || requestedWidths[id] === "half" || requestedWidths[id] === "full") widths[id] = requestedWidths[id];
  }
  return { order, visible, widths };
}

export function displayMemberName(member: { firstName: string; lastName: string | null; family: { lastName: string } }) {
  return `${member.firstName} ${member.lastName || member.family.lastName}`;
}
