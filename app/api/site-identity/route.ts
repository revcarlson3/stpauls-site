import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { siteIdentityAssetUrl } from "@/lib/site-identity";
import { requireCurrentChurch } from "@/lib/tenant";

export async function GET() {
  try {
    const { church } = await requireCurrentChurch();
    const settings = await db.siteIdentity.findUnique({ where: { churchId: church.id } });
    return NextResponse.json({ siteName: settings?.siteName ?? church.name, siteUrl: settings?.siteUrl ?? church.siteUrl, siteTagline: settings?.siteTagline ?? church.tagline, siteAddressStreet: settings?.siteAddressStreet ?? church.addressStreet, siteAddressCity: settings?.siteAddressCity ?? church.city ?? "", siteAddressState: settings?.siteAddressState ?? church.state ?? "", siteAddressZip: settings?.siteAddressZip ?? church.postalCode ?? "", sitePhone: settings?.sitePhone ?? church.phone, siteEmail: settings?.siteEmail ?? church.email, siteTaxId: settings?.siteTaxId ?? church.taxId, siteLogoUrl: siteIdentityAssetUrl(settings?.siteLogoUrl, church.id), siteLogoLightUrl: siteIdentityAssetUrl(settings?.siteLogoLightUrl || settings?.siteLogoUrl, church.id), siteLogoDarkUrl: siteIdentityAssetUrl(settings?.siteLogoDarkUrl, church.id), siteFaviconUrl: siteIdentityAssetUrl(settings?.siteFaviconUrl, church.id), siteFaviconConfigured: Boolean(settings?.siteFaviconUrl), siteShowTitle: settings?.siteShowTitle ?? true, siteShowTagline: settings?.siteShowTagline ?? true, siteShowLogo: settings?.siteShowLogo ?? false });
  } catch {
    return NextResponse.json({ error: "Unable to load site identity." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  if (input && typeof input.siteFaviconUrl === "string" && input.siteUrl === undefined) {
    if (input.siteFaviconUrl && !input.siteFaviconUrl.startsWith("/api/media/upload?file=") && !input.siteFaviconUrl.startsWith("/uploads/site-identity/")) {
      return NextResponse.json({ error: "Invalid favicon asset." }, { status: 400 });
    }
    try {
      await requirePermission("MANAGE_SETTINGS");
      const { church } = await requireCurrentChurch();
      await db.siteIdentity.upsert({ where: { churchId: church.id }, update: { siteFaviconUrl: input.siteFaviconUrl }, create: { churchId: church.id, siteFaviconUrl: input.siteFaviconUrl } });
      return NextResponse.json({ saved: true });
    } catch (error) {
      return apiErrorResponse(error, "Unable to save favicon.");
    }
  }
  if (!input || typeof input.siteUrl !== "string") {
    return NextResponse.json({ error: "Invalid site identity." }, { status: 400 });
  }
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    const identity = Object.fromEntries([
      ["siteName", typeof input.siteName === "string" ? input.siteName.trim() : "St. Paul's"],
      ["siteUrl", input.siteUrl.trim()],
      ...["siteAddressStreet", "siteAddressCity", "siteAddressState", "siteAddressZip", "sitePhone", "siteEmail", "siteTaxId"].map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""])
    ]);
    if (user.churchId) {
      await db.siteIdentity.upsert({ where: { churchId: user.churchId }, update: identity, create: { churchId: user.churchId, ...identity } });
      await db.church.update({
        where: { id: user.churchId },
        data: { name: identity.siteName, siteUrl: identity.siteUrl, addressStreet: identity.siteAddressStreet, city: identity.siteAddressCity || null, state: identity.siteAddressState || null, postalCode: identity.siteAddressZip || null, phone: identity.sitePhone, email: identity.siteEmail, taxId: identity.siteTaxId }
      });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save site identity.");
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const formData = await request.formData();
    const asset = formData.get("asset");
    const kind = formData.get("kind");
    if (!(asset instanceof File) || !asset.size || !["logo-light", "logo-dark", "favicon"].includes(String(kind)) || !["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"].includes(asset.type) || asset.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Choose an image up to 5 MB." }, { status: 400 });
    }

    const extension = asset.name.includes(".") ? `.${asset.name.split(".").pop()?.toLowerCase()}` : ".bin";
    const { church } = await requireCurrentChurch();
    const relativePath = `/uploads/site-identity/${church.id}/${kind}-${randomUUID()}${extension}`;
    await mkdir(path.join(process.cwd(), "public", "uploads", "site-identity", church.id), { recursive: true });
    await writeFile(path.join(process.cwd(), "public", relativePath), Buffer.from(await asset.arrayBuffer()));
    return NextResponse.json({ url: siteIdentityAssetUrl(relativePath, church.id) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to upload site identity asset.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const input = await request.json();
    if (!input || !["logo", "logo-light", "logo-dark", "favicon"].includes(input.kind)) return NextResponse.json({ error: "Invalid identity asset." }, { status: 400 });
    const { church } = await requireCurrentChurch();
    const current = await db.siteIdentity.findUnique({ where: { churchId: church.id }, select: { siteLogoUrl: true, siteLogoLightUrl: true, siteLogoDarkUrl: true, siteFaviconUrl: true } });
    const field = input.kind === "logo" ? "siteLogoUrl" : input.kind === "logo-light" ? "siteLogoLightUrl" : input.kind === "logo-dark" ? "siteLogoDarkUrl" : "siteFaviconUrl";
    const currentPath = input.kind === "logo" ? current?.siteLogoUrl : input.kind === "logo-light" ? current?.siteLogoLightUrl : input.kind === "logo-dark" ? current?.siteLogoDarkUrl : current?.siteFaviconUrl;
    if (currentPath?.startsWith("/uploads/site-identity/")) await unlink(path.join(process.cwd(), "public", currentPath)).catch(() => undefined);
    await db.siteIdentity.update({ where: { churchId: church.id }, data: { [field]: "", ...(input.kind === "logo-light" ? { siteLogoUrl: "" } : {}) } });
    return NextResponse.json({ removed: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to remove site identity asset.");
  }
}
