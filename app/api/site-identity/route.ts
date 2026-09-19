import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { siteIdentityAssetUrl } from "@/lib/site-identity";

export async function GET() {
  try {
    const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { siteName: true, siteUrl: true, siteTagline: true, siteAddressStreet: true, siteAddressCity: true, siteAddressState: true, siteAddressZip: true, sitePhone: true, siteEmail: true, siteTaxId: true, siteLogoUrl: true, siteLogoLightUrl: true, siteLogoDarkUrl: true, siteFaviconUrl: true, siteShowTitle: true, siteShowTagline: true, siteShowLogo: true } });
    return NextResponse.json({ siteName: settings?.siteName ?? "St. Paul's", siteUrl: settings?.siteUrl ?? "", siteTagline: settings?.siteTagline ?? "A place to belong.", siteAddressStreet: settings?.siteAddressStreet ?? "", siteAddressCity: settings?.siteAddressCity ?? "", siteAddressState: settings?.siteAddressState ?? "", siteAddressZip: settings?.siteAddressZip ?? "", sitePhone: settings?.sitePhone ?? "", siteEmail: settings?.siteEmail ?? "", siteTaxId: settings?.siteTaxId ?? "", siteLogoUrl: siteIdentityAssetUrl(settings?.siteLogoUrl), siteLogoLightUrl: siteIdentityAssetUrl(settings?.siteLogoLightUrl || settings?.siteLogoUrl), siteLogoDarkUrl: siteIdentityAssetUrl(settings?.siteLogoDarkUrl), siteFaviconUrl: siteIdentityAssetUrl(settings?.siteFaviconUrl), siteShowTitle: settings?.siteShowTitle ?? true, siteShowTagline: settings?.siteShowTagline ?? true, siteShowLogo: settings?.siteShowLogo ?? false });
  } catch {
    return NextResponse.json({ error: "Unable to load site identity." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  if (!input || typeof input.siteUrl !== "string") {
    return NextResponse.json({ error: "Invalid site identity." }, { status: 400 });
  }
  try {
    await requirePermission("MANAGE_SETTINGS");
    await db.securitySettings.upsert({
      where: { id: 1 },
      update: Object.fromEntries([
        ["siteName", typeof input.siteName === "string" ? input.siteName.trim() : "St. Paul's"],
        ["siteUrl", input.siteUrl.trim()],
        ...["siteAddressStreet", "siteAddressCity", "siteAddressState", "siteAddressZip", "sitePhone", "siteEmail", "siteTaxId"].map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""])
      ]),
      create: {
        id: 1,
        siteName: typeof input.siteName === "string" ? input.siteName.trim() : "St. Paul's",
        siteUrl: input.siteUrl.trim(),
        ...Object.fromEntries(["siteAddressStreet", "siteAddressCity", "siteAddressState", "siteAddressZip", "sitePhone", "siteEmail", "siteTaxId"].map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""]))
      }
    });
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
    const relativePath = `/uploads/site-identity/${kind}-${randomUUID()}${extension}`;
    await mkdir(path.join(process.cwd(), "public", "uploads", "site-identity"), { recursive: true });
    await writeFile(path.join(process.cwd(), "public", relativePath), Buffer.from(await asset.arrayBuffer()));
    return NextResponse.json({ url: siteIdentityAssetUrl(relativePath) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to upload site identity asset.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const input = await request.json();
    if (!input || !["logo", "logo-light", "logo-dark", "favicon"].includes(input.kind)) return NextResponse.json({ error: "Invalid identity asset." }, { status: 400 });
    const current = await db.securitySettings.findUnique({ where: { id: 1 }, select: { siteLogoUrl: true, siteLogoLightUrl: true, siteLogoDarkUrl: true, siteFaviconUrl: true } });
    const field = input.kind === "logo" ? "siteLogoUrl" : input.kind === "logo-light" ? "siteLogoLightUrl" : input.kind === "logo-dark" ? "siteLogoDarkUrl" : "siteFaviconUrl";
    const currentPath = input.kind === "logo" ? current?.siteLogoUrl : input.kind === "logo-light" ? current?.siteLogoLightUrl : input.kind === "logo-dark" ? current?.siteLogoDarkUrl : current?.siteFaviconUrl;
    if (currentPath?.startsWith("/uploads/site-identity/")) await unlink(path.join(process.cwd(), "public", currentPath)).catch(() => undefined);
    await db.securitySettings.update({ where: { id: 1 }, data: { [field]: "", ...(input.kind === "logo-light" ? { siteLogoUrl: "" } : {}) } });
    return NextResponse.json({ removed: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to remove site identity asset.");
  }
}
