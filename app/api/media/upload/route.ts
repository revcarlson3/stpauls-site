import { apiErrorResponse } from "@/lib/api-errors";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { allowedMediaMimeTypes, inferMediaMimeType, parseMediaByteRange, readMediaFile, saveUploadedMediaFile } from "@/lib/media";
import { db } from "@/lib/db";
import { headers as requestHeaders } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { resolvePublicTenant } from "@/lib/platform-domain";
import { tenantOwnsResource } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const user = await requirePermission(formData.get("context") === "site-settings" ? "MANAGE_SETTINGS" : "EDIT_PAGES");
    const asset = formData.get("asset");
    if (!(asset instanceof File) || !asset.size || !allowedMediaMimeTypes.has(asset.type) || asset.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "Choose a supported image, video, audio, or document file up to 100 MB." }, { status: 400 });
    }
    const extension = asset.name.includes(".") ? `.${asset.name.split(".").pop()?.toLowerCase()}` : ".bin";
    const filename = `${randomUUID()}${extension}`;
    const uploaded = await saveUploadedMediaFile({ asset, filename, uploader: user });
    return NextResponse.json({ url: uploaded.url, asset: uploaded }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to upload image.");
  }
}

export async function GET(request: Request) {
  const filename = new URL(request.url).searchParams.get("file") ?? "";
  if (!/^[a-zA-Z0-9-]+\.(png|jpe?g|webp|gif|mp4|webm|mov|pdf|docx?|xlsx?|pptx?|rtf|txt|csv|xml|json|zip|rar|7z|gz|odt|ods|odp)$/.test(filename)) return NextResponse.json({ error: "Invalid media file." }, { status: 400 });
  try {
    const requestedTenant = new URL(request.url).searchParams.get("tenant");
    const publicTenant = await resolvePublicTenant(requestHeaders().get("host"));
    const user = await getCurrentUser();
    const churchId = publicTenant?.id ?? user?.churchId;
    if (!churchId || (requestedTenant && !tenantOwnsResource(requestedTenant, churchId))) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const asset = await db.mediaAsset.findFirst({ where: { storedFilename: filename, churchId }, select: { churchId: true, url: true } });
    if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const file = await readMediaFile(filename, churchId, asset.url.startsWith("/api/media/upload?file="));
    const contentType = inferMediaMimeType(filename);
    const range = parseMediaByteRange(request.headers.get("range"), file.byteLength);
    if (range === null) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.byteLength}`, "Accept-Ranges": "bytes" } });
    }
    const body = range ? new Uint8Array(file).slice(range.start, range.end + 1) : new Uint8Array(file);
    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(body.byteLength),
      "Content-Type": contentType,
      ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${file.byteLength}` } : {})
    };
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
