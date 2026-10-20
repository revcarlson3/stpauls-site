import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { resolvePublicTenant } from "@/lib/platform-domain";
import { db } from "@/lib/db";
import { tenantOwnsResource } from "@/lib/tenant";

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export async function GET(request: Request) {
  const assetPath = new URL(request.url).searchParams.get("path") || "";
  if (!assetPath.startsWith("/uploads/site-identity/") || assetPath.includes("..")) {
    return NextResponse.json({ error: "Invalid identity asset." }, { status: 400 });
  }

  try {
    const requestedTenant = new URL(request.url).searchParams.get("tenant");
    const publicTenant = await resolvePublicTenant(headers().get("host"));
    const user = await getCurrentUser();
    const churchId = publicTenant?.id ?? user?.churchId;
    if (!churchId || (requestedTenant && !tenantOwnsResource(requestedTenant, churchId))) {
      return NextResponse.json({ error: "Identity asset not found." }, { status: 404 });
    }
    const identity = await db.siteIdentity.findUnique({ where: { churchId }, select: { siteLogoUrl: true, siteLogoLightUrl: true, siteLogoDarkUrl: true, siteFaviconUrl: true } });
    if (!identity || !Object.values(identity).includes(assetPath)) {
      return NextResponse.json({ error: "Identity asset not found." }, { status: 404 });
    }
    const file = await readFile(path.join(process.cwd(), "public", assetPath));
    const extension = path.extname(assetPath).toLowerCase();
    return new NextResponse(file, { headers: { "Content-Type": contentTypes[extension] || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "Identity asset not found." }, { status: 404 });
  }
}
