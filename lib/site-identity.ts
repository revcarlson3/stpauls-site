import { db } from "@/lib/db";

export function siteIdentityAssetUrl(value: string | null | undefined) {
  const path = value?.trim();
  return path?.startsWith("/uploads/site-identity/")
    ? `/api/site-identity/asset?path=${encodeURIComponent(path)}`
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

export async function getSiteIdentity() {
  const settings = await db.securitySettings.findUnique({
    where: { id: 1 },
    select: { siteName: true, siteUrl: true, siteTagline: true, siteAddressStreet: true, siteAddressCity: true, siteAddressState: true, siteAddressZip: true, sitePhone: true, siteEmail: true, siteTaxId: true, siteLogoUrl: true, siteLogoLightUrl: true, siteLogoDarkUrl: true, siteFaviconUrl: true, siteShowTitle: true, siteShowTagline: true, siteShowLogo: true }
  });

  return {
    name: settings?.siteName?.trim() || DEFAULT_SITE_IDENTITY.name,
    url: settings?.siteUrl?.trim() || DEFAULT_SITE_IDENTITY.url,
    tagline: settings?.siteTagline?.trim() || DEFAULT_SITE_IDENTITY.tagline,
    addressStreet: settings?.siteAddressStreet?.trim() || "",
    addressCity: settings?.siteAddressCity?.trim() || "",
    addressState: settings?.siteAddressState?.trim() || "",
    addressZip: settings?.siteAddressZip?.trim() || "",
    phone: settings?.sitePhone?.trim() || "",
    email: settings?.siteEmail?.trim() || "",
    taxId: settings?.siteTaxId?.trim() || "",
    logoUrl: siteIdentityAssetUrl(settings?.siteLogoLightUrl || settings?.siteLogoUrl) || DEFAULT_SITE_IDENTITY.logoUrl,
    logoLightUrl: siteIdentityAssetUrl(settings?.siteLogoLightUrl || settings?.siteLogoUrl) || DEFAULT_SITE_IDENTITY.logoLightUrl,
    logoDarkUrl: siteIdentityAssetUrl(settings?.siteLogoDarkUrl) || DEFAULT_SITE_IDENTITY.logoDarkUrl,
    faviconUrl: DEFAULT_SITE_IDENTITY.faviconUrl,
    showTitle: settings?.siteShowTitle ?? DEFAULT_SITE_IDENTITY.showTitle,
    showTagline: settings?.siteShowTagline ?? DEFAULT_SITE_IDENTITY.showTagline,
    showLogo: settings?.siteShowLogo ?? DEFAULT_SITE_IDENTITY.showLogo
  };
}
