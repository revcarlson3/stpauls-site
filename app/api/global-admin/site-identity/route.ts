import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logGlobalAdminAction, requireGlobalAdmin } from "@/lib/global-admin";
import { normalizeGlobalAdminSiteIdentity } from "@/lib/global-admin-site";

function authorizationError(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
  return NextResponse.json({ error: "A selected site is required." }, { status: 409 });
}

export async function GET() {
  let context;
  try {
    context = await requireGlobalAdmin({ selectedChurch: true });
  } catch (error) {
    return authorizationError(error);
  }
  const [church, settings] = await Promise.all([
    db.church.findUnique({
      where: { id: context.church!.id },
      select: { name: true, slug: true, siteUrl: true, tagline: true, addressStreet: true, city: true, state: true, postalCode: true, phone: true, email: true, taxId: true, enabledModules: true }
    }),
    db.securitySettings.findUnique({ where: { id: 1 }, select: { siteName: true, siteUrl: true, siteTagline: true, siteAddressStreet: true, siteAddressCity: true, siteAddressState: true, siteAddressZip: true, sitePhone: true, siteEmail: true, siteTaxId: true } })
  ]);
  if (!church) return NextResponse.json({ error: "The selected site is unavailable." }, { status: 404 });
  return NextResponse.json({
    site: {
      name: church.name || settings?.siteName || "",
      slug: church.slug,
      url: church.siteUrl || settings?.siteUrl || "",
      tagline: church.tagline || settings?.siteTagline || "",
      addressStreet: church.addressStreet || settings?.siteAddressStreet || "",
      city: church.city || settings?.siteAddressCity || "",
      state: church.state || settings?.siteAddressState || "",
      postalCode: church.postalCode || settings?.siteAddressZip || "",
      phone: church.phone || settings?.sitePhone || "",
      email: church.email || settings?.siteEmail || "",
      taxId: church.taxId || settings?.siteTaxId || "",
      enabledModules: Array.isArray(church.enabledModules) ? church.enabledModules.filter((slug): slug is string => typeof slug === "string") : []
    }
  });
}

export async function PATCH(request: Request) {
  const input = await request.json().catch(() => null);
  const identity = normalizeGlobalAdminSiteIdentity(input);
  if (!identity) return NextResponse.json({ error: "Enter a valid site identity and choose known modules." }, { status: 400 });

  let context;
  try {
    context = await requireGlobalAdmin({ selectedChurch: true });
  } catch (error) {
    return authorizationError(error);
  }
  const churchId = context.church!.id;
  const current = await db.church.findUnique({ where: { id: churchId }, select: { name: true, siteUrl: true, tagline: true, addressStreet: true, city: true, state: true, postalCode: true, phone: true, email: true, taxId: true, enabledModules: true } });
  if (!current) return NextResponse.json({ error: "The selected site is unavailable." }, { status: 404 });

  await db.$transaction([
    db.church.update({
      where: { id: churchId },
      data: { name: identity.name, siteUrl: identity.url, tagline: identity.tagline, addressStreet: identity.addressStreet, city: identity.city || null, state: identity.state || null, postalCode: identity.postalCode || null, phone: identity.phone, email: identity.email, taxId: identity.taxId, enabledModules: identity.enabledModules }
    }),
    db.securitySettings.upsert({
      where: { id: 1 },
      update: { siteName: identity.name, siteUrl: identity.url, siteTagline: identity.tagline, siteAddressStreet: identity.addressStreet, siteAddressCity: identity.city, siteAddressState: identity.state, siteAddressZip: identity.postalCode, sitePhone: identity.phone, siteEmail: identity.email, siteTaxId: identity.taxId },
      create: { id: 1, siteName: identity.name, siteUrl: identity.url, siteTagline: identity.tagline, siteAddressStreet: identity.addressStreet, siteAddressCity: identity.city, siteAddressState: identity.state, siteAddressZip: identity.postalCode, sitePhone: identity.phone, siteEmail: identity.email, siteTaxId: identity.taxId }
    })
  ]);
  const changedFields = Object.entries({
    name: identity.name !== current.name,
    url: identity.url !== current.siteUrl,
    tagline: identity.tagline !== current.tagline,
    address: identity.addressStreet !== current.addressStreet || identity.city !== (current.city ?? "") || identity.state !== (current.state ?? "") || identity.postalCode !== (current.postalCode ?? ""),
    contact: identity.phone !== current.phone || identity.email !== current.email || identity.taxId !== current.taxId,
    modules: JSON.stringify(identity.enabledModules) !== JSON.stringify(current.enabledModules)
  }).filter(([, changed]) => changed).map(([field]) => field);
  await logGlobalAdminAction({ activityType: "global-admin-site-identity-updated", summary: "Updated the selected site's identity and enabled modules.", targetType: "church", targetId: churchId, metadata: { changedFields, enabledModules: identity.enabledModules } });
  return NextResponse.json({ saved: true, site: identity });
}
