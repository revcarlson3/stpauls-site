import { apiErrorResponse } from "@/lib/api-errors";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { allowedMediaMimeTypes, inferMediaMimeType, readMediaFile, saveUploadedMediaFile } from "@/lib/media";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("EDIT_PAGES");
    const formData = await request.formData();
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
    const file = await readMediaFile(filename);
    const contentType = inferMediaMimeType(filename);
    return new Response(new Uint8Array(file), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
