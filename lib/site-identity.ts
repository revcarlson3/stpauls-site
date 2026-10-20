import { db } from "@/lib/db";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { resolvePublicTenant } from "@/lib/platform-domain";

export function siteIdentityAssetUrl(value: string | null | undefined, churchId?: string | null) {
  const path = value?.trim();
  return path?.startsWith("/uploads/site-identity/")
    ? `/api/site-identity/asset?${churchId ? `tenant=${encodeURIComponent(churchId)}&` : ""}path=${encodeURIComponent(path)}`
    : path || "";
}

export const DEFAULT_SITE_IDENTITY = {
  name: "St. Paul's",
  url: "",
  tagline: "A place to belong.",
  logoUrl: "",
  logoLightUrl: "",
  logoDarkUrl: "",
  faviconUrl: "/mychurch-one-favicon.svg",
  showTitle: true,
  showTagline: true,
  showLogo: false
};

export async function getSiteIdentity(churchId?: string | null) {
  const resolvedChurchId = churchId ?? await resolveIdentityChurchId();
  const settings = resolvedChurchId ? await db.siteIdentity.findUnique({ where: { churchId: resolvedChurchId } }) : null;
  const church = resolvedChurchId && !settings ? await db.church.findUnique({ where: { id: resolvedChurchId }, select: { name: true, siteUrl: true, tagline: true, addressStreet: true, city: true, state: true, postalCode: true, phone: true, email: true, taxId: true } }) : null;

  return {
    name: settings?.siteName?.trim() || church?.name?.trim() || DEFAULT_SITE_IDENTITY.name,
    url: settings?.siteUrl?.trim() || church?.siteUrl?.trim() || DEFAULT_SITE_IDENTITY.url,
    tagline: settings?.siteTagline?.trim() || church?.tagline?.trim() || DEFAULT_SITE_IDENTITY.tagline,
    addressStreet: settings?.siteAddressStreet?.trim() || church?.addressStreet?.trim() || "",
    addressCity: settings?.siteAddressCity?.trim() || church?.city?.trim() || "",
    addressState: settings?.siteAddressState?.trim() || church?.state?.trim() || "",
    addressZip: settings?.siteAddressZip?.trim() || church?.postalCode?.trim() || "",
    phone: settings?.sitePhone?.trim() || church?.phone?.trim() || "",
    email: settings?.siteEmail?.trim() || church?.email?.trim() || "",
    taxId: settings?.siteTaxId?.trim() || church?.taxId?.trim() || "",
    logoUrl: siteIdentityAssetUrl(settings?.siteLogoLightUrl || settings?.siteLogoUrl, resolvedChurchId) || DEFAULT_SITE_IDENTITY.logoUrl,
    logoLightUrl: siteIdentityAssetUrl(settings?.siteLogoLightUrl || settings?.siteLogoUrl, resolvedChurchId) || DEFAULT_SITE_IDENTITY.logoLightUrl,
    logoDarkUrl: siteIdentityAssetUrl(settings?.siteLogoDarkUrl, resolvedChurchId) || DEFAULT_SITE_IDENTITY.logoDarkUrl,
    faviconUrl: siteIdentityAssetUrl(settings?.siteFaviconUrl, resolvedChurchId) || DEFAULT_SITE_IDENTITY.faviconUrl,
    showTitle: settings?.siteShowTitle ?? DEFAULT_SITE_IDENTITY.showTitle,
    showTagline: settings?.siteShowTagline ?? DEFAULT_SITE_IDENTITY.showTagline,
    showLogo: settings?.siteShowLogo ?? DEFAULT_SITE_IDENTITY.showLogo
  };
}

async function resolveIdentityChurchId() {
  const tenant = await resolvePublicTenant(headers().get("host"));
  if (tenant?.id) return tenant.id;
  return (await getCurrentUser())?.churchId ?? null;
}
