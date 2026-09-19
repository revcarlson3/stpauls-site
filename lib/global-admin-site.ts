import { MODULES, normalizeModuleSlugs } from "@/lib/modules";

export type GlobalAdminSiteIdentity = {
  name: string;
  url: string;
  tagline: string;
  addressStreet: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  taxId: string;
  enabledModules: string[];
};

const MAX_LENGTHS = {
  name: 120,
  url: 2048,
  tagline: 240,
  addressStreet: 160,
  city: 100,
  state: 2,
  postalCode: 20,
  phone: 40,
  email: 254,
  taxId: 40
} as const;

function stringValue(input: Record<string, unknown>, field: keyof Omit<GlobalAdminSiteIdentity, "enabledModules">) {
  const value = input[field];
  return typeof value === "string" ? value.trim() : null;
}

export function normalizeGlobalAdminSiteIdentity(input: unknown): GlobalAdminSiteIdentity | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const name = stringValue(value, "name");
  const url = stringValue(value, "url");
  const tagline = stringValue(value, "tagline");
  const addressStreet = stringValue(value, "addressStreet");
  const city = stringValue(value, "city");
  const state = stringValue(value, "state");
  const postalCode = stringValue(value, "postalCode");
  const phone = stringValue(value, "phone");
  const email = stringValue(value, "email");
  const taxId = stringValue(value, "taxId");
  if ([name, url, tagline, addressStreet, city, state, postalCode, phone, email, taxId].some((field) => field === null)) return null;
  if (!Array.isArray(value.enabledModules) || value.enabledModules.some((slug) => typeof slug !== "string" || !isKnownGlobalAdminModule(slug))) return null;
  const enabledModules = normalizeModuleSlugs(value.enabledModules);
  if (!enabledModules || !name || !tagline) return null;
  const identity = { name, url, tagline, addressStreet, city, state, postalCode, phone, email, taxId } as Record<keyof Omit<GlobalAdminSiteIdentity, "enabledModules">, string>;
  if (Object.entries(identity).some(([field, entry]) => entry.length > MAX_LENGTHS[field as keyof typeof MAX_LENGTHS])) return null;
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return null;
  if (state && !/^[A-Z]{2}$/.test(state)) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { ...identity, enabledModules };
}

export function isKnownGlobalAdminModule(slug: string) {
  return MODULES.some((module) => module.slug === slug);
}
