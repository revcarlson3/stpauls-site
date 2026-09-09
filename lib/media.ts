import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import exifr from "exifr";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, type User } from "@/lib/auth";
import type { MediaAssetUpdateInput, MediaFilter, MediaLinkedFilter } from "@/lib/media-input";

const mediaDirectory = path.join(process.cwd(), "public", "uploads", "page-media");

const extensionMimeTypes = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["mp4", "video/mp4"],
  ["webm", "video/webm"],
  ["mov", "video/quicktime"]
  ,["pdf", "application/pdf"]
  ,["doc", "application/msword"]
  ,["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  ,["xls", "application/vnd.ms-excel"]
  ,["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
  ,["ppt", "application/vnd.ms-powerpoint"]
  ,["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
  ,["rtf", "application/rtf"]
  ,["txt", "text/plain"]
  ,["csv", "text/csv"]
  ,["xml", "application/xml"]
  ,["json", "application/json"]
  ,["zip", "application/zip"]
  ,["rar", "application/vnd.rar"]
  ,["7z", "application/x-7z-compressed"]
  ,["gz", "application/gzip"]
  ,["odt", "application/vnd.oasis.opendocument.text"]
  ,["ods", "application/vnd.oasis.opendocument.spreadsheet"]
  ,["odp", "application/vnd.oasis.opendocument.presentation"]
]);

export const allowedMediaMimeTypes = new Set(extensionMimeTypes.values());

export function mediaServeUrl(filename: string) {
  return `/api/media/upload?file=${encodeURIComponent(filename)}`;
}

export function mediaAbsolutePath(filename: string) {
  return path.join(mediaDirectory, filename);
}

export function inferMediaMimeType(filename: string) {
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  return extensionMimeTypes.get(extension) ?? "application/octet-stream";
}

export function mediaTypeFromMimeType(mimeType: string): Exclude<MediaFilter, "all"> {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("application/") || mimeType.startsWith("text/")) return "document";
  return "other";
}

export async function createUploadedMediaAsset(input: {
  originalName: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploaderId?: string | null;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  tags?: string[];
}) {
  const buffer = await readFile(mediaAbsolutePath(input.storedFilename)).catch(() => null);
  const dimensions = input.mimeType.startsWith("image/") && buffer ? await imageDimensions(buffer) : {};
  const embedded = input.mimeType.startsWith("image/") && buffer ? await embeddedImageMetadata(buffer) : {};
  const folder = folderForDate(new Date());
  return db.mediaAsset.create({
    data: {
      originalName: input.originalName,
      storedFilename: input.storedFilename,
      url: mediaServeUrl(input.storedFilename),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      folder,
      ...dimensions,
      altText: input.altText ?? null,
      title: input.title ?? embedded.title ?? guessTitle(input.originalName),
      caption: input.caption ?? embedded.caption ?? null,
      description: input.description ?? embedded.description ?? null,
      tags: normalizeTags(input.tags ?? []),
      uploaderId: input.uploaderId ?? null
    },
    include: mediaInclude
  }).then(serializeMediaAsset);
}

export async function listMediaAssets(input: { search?: string | null; type?: MediaFilter; linked?: MediaLinkedFilter; folder?: string | null; generated?: "all" | "generated" | "standard" }) {
  await requirePermission("EDIT_PAGES");
  await syncLegacyMediaAssets();
  const search = input.search?.trim() ?? "";
  const filters: Prisma.MediaAssetWhereInput[] = [];
  const typeWhere = mediaTypeWhere(input.type ?? "all");
  if (typeWhere) filters.push(typeWhere);
  if (input.folder) filters.push({ folder: input.folder });
  if (input.generated === "generated") filters.push({ tags: { has: "ai-generated" } });
  if (input.generated === "standard") filters.push({ NOT: { tags: { has: "ai-generated" } } });
  if (search) {
    filters.push({
      OR: [
        { originalName: { contains: search, mode: "insensitive" } },
        { storedFilename: { contains: search, mode: "insensitive" } },
        { url: { contains: search, mode: "insensitive" } },
        { mimeType: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { altText: { contains: search, mode: "insensitive" } },
        { caption: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } }
      ]
    });
  }
  const assets = await db.mediaAsset.findMany({
    where: filters.length ? { AND: filters } : undefined,
    include: mediaInclude,
    orderBy: [{ createdAt: "desc" }, { originalName: "asc" }]
  });
  const linkedPages = await linkedPagesByUrl();
  return assets.map((asset) => serializeMediaAsset(asset, linkedPages.get(asset.url) ?? [])).filter((asset) => input.linked === "linked" ? asset.linkedPages.length > 0 : input.linked === "unlinked" ? asset.linkedPages.length === 0 : true);
}

export async function backfillEmbeddedMediaMetadata() {
  await requirePermission("EDIT_PAGES");
  const assets = await db.mediaAsset.findMany({
    where: {
      mimeType: { startsWith: "image/" },
      OR: [{ caption: null }, { description: null }]
    },
    select: { id: true, storedFilename: true, caption: true, description: true }
  });
  let updated = 0;
  for (const asset of assets) {
    const file = await readFile(mediaAbsolutePath(asset.storedFilename)).catch(() => null);
    if (!file) continue;
    const metadata = await embeddedImageMetadata(file);
    const data = {
      ...(asset.caption === null && metadata.caption ? { caption: metadata.caption } : {}),
      ...(asset.description === null && metadata.description ? { description: metadata.description } : {})
    };
    if (!Object.keys(data).length) continue;
    await db.mediaAsset.update({ where: { id: asset.id }, data });
    updated += 1;
  }
  return { scanned: assets.length, updated };
}

export async function listMediaFolders() {
  await requirePermission("EDIT_PAGES");
  const folders = await db.mediaAsset.groupBy({
    by: ["folder"],
    _count: { _all: true },
    orderBy: { folder: "asc" }
  });
  return folders.map((folder) => ({ name: folder.folder, count: folder._count._all }));
}

export async function mergeMediaFolders(from: string, to: string) {
  await requirePermission("EDIT_PAGES");
  if (!from || !to || from === to || from.length > 80 || to.length > 80) throw new Error("Choose two different valid folders.");
  const result = await db.mediaAsset.updateMany({ where: { folder: from }, data: { folder: to } });
  return { moved: result.count, from, to };
}

export async function updateMediaAsset(id: string, input: MediaAssetUpdateInput) {
  await requirePermission("EDIT_PAGES");
  const asset = await db.mediaAsset.update({
    where: { id },
    data: {
      ...(input.folder !== undefined ? { folder: input.folder } : {}),
      ...(input.altText !== undefined ? { altText: input.altText } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      tags: input.tags === undefined ? undefined : normalizeTags(input.tags)
    },
    include: mediaInclude
  });
  return serializeMediaAsset(asset, (await linkedPagesByUrl()).get(asset.url) ?? []);
}

export async function deleteMediaAsset(id: string) {
  await requirePermission("EDIT_PAGES");
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { id: true, storedFilename: true, url: true } });
  if (!asset) throw new Error("Media asset not found.");
  const linked = (await linkedPagesByUrl()).get(asset.url) ?? [];
  if (linked.length) throw new Error(`Cannot delete linked media asset. It is used by: ${linked.map((page) => page.title).join(", ")}.`);
  await db.mediaAsset.delete({ where: { id } });
  if (asset.url.startsWith("/api/media/upload?file=")) {
    await unlink(mediaAbsolutePath(asset.storedFilename)).catch(() => undefined);
  }
  return { deleted: true, id: asset.id };
}

export async function saveUploadedMediaFile(input: {
  asset: File;
  filename: string;
  uploader?: User | null;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  tags?: string[];
}) {
  const buffer = Buffer.from(await input.asset.arrayBuffer());
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(mediaAbsolutePath(input.filename), buffer);
  try {
    return await createUploadedMediaAsset({
      originalName: input.asset.name,
      storedFilename: input.filename,
      mimeType: input.asset.type,
      sizeBytes: input.asset.size,
      uploaderId: input.uploader?.id ?? null,
      altText: input.altText ?? null,
      title: input.title ?? null,
      caption: input.caption ?? null,
      description: input.description ?? null,
      tags: input.tags ?? []
    });
  } catch (error) {
    await unlink(mediaAbsolutePath(input.filename)).catch(() => undefined);
    throw error;
  }
}

export async function readMediaFile(filename: string) {
  return readFile(mediaAbsolutePath(filename));
}

export async function editMediaAsset(input: {
  assetId: string;
  crop?: { left: number; top: number; width: number; height: number };
  width?: number;
  height?: number;
  rotate?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  uploader?: User | null;
}) {
  await requirePermission("EDIT_PAGES");
  const source = await db.mediaAsset.findUnique({ where: { id: input.assetId } });
  if (!source) throw new Error("Media asset not found.");
  if (!source.mimeType.startsWith("image/") || source.mimeType === "image/gif") throw new Error("Only PNG, JPEG, and WebP images can be edited.");

  const sourceBuffer = await readFile(mediaAbsolutePath(source.storedFilename)).catch(() => null);
  if (!sourceBuffer) throw new Error("Media file not found.");

  const rotate = input.rotate ?? 0;
  let image = sharp(sourceBuffer).rotate(rotate);
  if (input.flipHorizontal) image = image.flop();
  if (input.flipVertical) image = image.flip();

  const transformedMetadata = await image.metadata();
  const transformedWidth = transformedMetadata.width ?? 0;
  const transformedHeight = transformedMetadata.height ?? 0;
  if (!transformedWidth || !transformedHeight) throw new Error("Unable to read image dimensions.");

  if (input.crop) {
    const left = Math.max(0, Math.floor(input.crop.left));
    const top = Math.max(0, Math.floor(input.crop.top));
    const width = Math.floor(input.crop.width);
    const height = Math.floor(input.crop.height);
    if (width < 1 || height < 1 || left + width > transformedWidth || top + height > transformedHeight) {
      throw new Error("The crop area is outside the image.");
    }
    image = image.extract({ left, top, width, height });
  }

  const width = input.width ? Math.floor(input.width) : undefined;
  const height = input.height ? Math.floor(input.height) : undefined;
  if ((width !== undefined && (width < 1 || width > 12000)) || (height !== undefined && (height < 1 || height > 12000))) {
    throw new Error("Resize dimensions must be between 1 and 12,000 pixels.");
  }
  if (width || height) image = image.resize(width, height, { fit: "inside", withoutEnlargement: false });

  const output = await image.toFormat("png").toBuffer();
  const filename = `${randomUUID()}.png`;
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(mediaAbsolutePath(filename), output);
  try {
    return await createUploadedMediaAsset({
      originalName: `${source.originalName.replace(/\.[^.]+$/, "")}-edited.png`,
      storedFilename: filename,
      mimeType: "image/png",
      sizeBytes: output.byteLength,
      uploaderId: input.uploader?.id ?? null,
      title: source.title ? `${source.title} (edited)` : undefined,
      altText: source.altText,
      caption: source.caption,
      description: source.description,
      tags: source.tags
    });
  } catch (error) {
    await unlink(mediaAbsolutePath(filename)).catch(() => undefined);
    throw error;
  }
}

async function syncLegacyMediaAssets() {
  const existing = await readdir(mediaDirectory, { withFileTypes: true }).catch(() => []);
  const legacyFiles = existing.filter((entry) => entry.isFile() && extensionMimeTypes.has(fileExtension(entry.name)));
  if (!legacyFiles.length) return;
  const known = new Set((await db.mediaAsset.findMany({ select: { storedFilename: true } })).map((item) => item.storedFilename));
  const missing = legacyFiles.filter((entry) => !known.has(entry.name));
  if (!missing.length) return;
  const records = await Promise.all(missing.map(async (entry) => {
    const file = await stat(mediaAbsolutePath(entry.name));
    const dimensions = inferMediaMimeType(entry.name).startsWith("image/") ? await imageDimensions(await readFile(mediaAbsolutePath(entry.name))) : {};
    return {
      originalName: entry.name,
      storedFilename: entry.name,
      url: mediaServeUrl(entry.name),
      mimeType: inferMediaMimeType(entry.name),
      sizeBytes: Number(file.size),
      folder: folderForDate(file.birthtime),
      altText: null,
      title: guessTitle(entry.name),
      caption: null,
      description: null,
      ...dimensions,
      tags: [] as string[],
      createdAt: file.birthtime,
      updatedAt: file.mtime
    };
  }));
  if (records.length) await db.mediaAsset.createMany({ data: records, skipDuplicates: true });
}

function serializeMediaAsset(asset: MediaAssetRecord, linkedPages: { id: string; title: string; slug: string }[] = []) {
  return { ...asset, linkedPages, mediaType: mediaTypeFromMimeType(asset.mimeType) };
}

function mediaTypeWhere(type: MediaFilter): Prisma.MediaAssetWhereInput | null {
  if (type === "image") return { mimeType: { startsWith: "image/" } };
  if (type === "video") return { mimeType: { startsWith: "video/" } };
  if (type === "audio") return { mimeType: { startsWith: "audio/" } };
  if (type === "document") return { OR: [{ mimeType: { startsWith: "application/" } }, { mimeType: { startsWith: "text/" } }] };
  if (type === "other") {
    return {
      NOT: [
        { mimeType: { startsWith: "image/" } },
        { mimeType: { startsWith: "video/" } },
        { mimeType: { startsWith: "audio/" } },
        { mimeType: { startsWith: "application/" } },
        { mimeType: { startsWith: "text/" } }
      ]
    };
  }
  return null;
}

function guessTitle(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const human = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return human || null;
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

function fileExtension(fileName: string) {
  return fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? "" : "";
}

const mediaInclude = { uploader: { select: { id: true, name: true, email: true } } } as const;
type MediaAssetRecord = Prisma.MediaAssetGetPayload<{ include: typeof mediaInclude }>;

function folderForDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function imageDimensions(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return {};
  }
}

async function embeddedImageMetadata(buffer: Buffer) {
  try {
    const metadata = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      iptc: true,
      xmp: true,
      gps: false,
      translateValues: true
    }) as Record<string, unknown> | undefined;
    if (!metadata) return {};
    const title = firstMetadataString(metadata, ["Title", "ObjectName", "Headline", "XPTitle"]);
    const caption = firstMetadataString(metadata, ["Caption-Abstract", "Description", "ImageDescription", "XPComment"]);
    const descriptionParts = [
      firstMetadataString(metadata, ["Artist", "Creator", "By-line"]),
      firstMetadataString(metadata, ["Credit", "Source"]),
      firstMetadataString(metadata, ["Copyright", "CopyrightNotice"])
    ].filter(Boolean);
    return {
      title,
      caption,
      description: descriptionParts.length ? `Attribution: ${descriptionParts.join(" · ")}` : undefined
    };
  } catch (error) {
    console.warn("Unable to read embedded image metadata.", error);
    return {};
  }
}

function firstMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const text = value.filter((item): item is string => typeof item === "string").join(", ").trim();
      if (text) return text;
    }
  }
  return undefined;
}

async function linkedPagesByUrl() {
  const pages = await db.page.findMany({ select: { id: true, title: true, slug: true, blocks: true } });
  const result = new Map<string, { id: string; title: string; slug: string }[]>();
  for (const page of pages) {
    const urls = new Set<string>();
    collectStrings(page.blocks, urls);
    urls.forEach((url) => {
      const current = result.get(url) ?? [];
      current.push({ id: page.id, title: page.title, slug: page.slug });
      result.set(url, current);
    });
  }
  return result;
}

function collectStrings(value: unknown, output: Set<string>) {
  if (typeof value === "string" && value.startsWith("/api/media/upload?file=")) output.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
}
