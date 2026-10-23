import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
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

export function mediaServeUrl(filename: string, churchId?: string) {
  return `/api/media/upload?${churchId ? `tenant=${encodeURIComponent(churchId)}&` : ""}file=${encodeURIComponent(filename)}`;
}

export function mediaThumbnailFilename(filename: string) {
  return `${filename}.thumb.webp`;
}

export function mediaThumbnailServeUrl(filename: string, churchId?: string) {
  return `${mediaServeUrl(filename, churchId)}&variant=thumbnail`;
}

export function mediaAbsolutePath(filename: string, churchId?: string) {
  const safeFilename = filename.replace(/\\/g, "/").replace(/^\/+/, "");
  if (churchId && !safeFilename.includes("/")) return path.join(mediaDirectory, churchId, safeFilename);
  return path.join(mediaDirectory, safeFilename);
}

export async function ensureMediaThumbnail(filename: string, churchId: string, allowLegacy = false) {
  const thumbnailPath = mediaAbsolutePath(mediaThumbnailFilename(filename), churchId);
  try {
    await stat(thumbnailPath);
    return thumbnailPath;
  } catch {
    const source = await readMediaFile(filename, churchId, allowLegacy);
    const thumbnail = await sharp(source)
      .rotate()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await mkdir(path.dirname(thumbnailPath), { recursive: true });
    await writeFile(thumbnailPath, thumbnail);
    return thumbnailPath;
  }
}

export async function optimizeImageBuffer(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/gif") return null;
  const image = sharp(buffer);
  let optimized: Buffer;
  if (mimeType === "image/jpeg") {
    optimized = await image.jpeg({ quality: 84, progressive: true, mozjpeg: true }).toBuffer();
  } else if (mimeType === "image/png") {
    optimized = await image.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  } else if (mimeType === "image/webp") {
    optimized = await image.webp({ quality: 84, effort: 5 }).toBuffer();
  } else {
    return null;
  }
  return optimized.length < buffer.length ? optimized : null;
}

export async function optimizeMediaAssetFile(input: { filename: string; churchId: string; mimeType: string; allowLegacy?: boolean }) {
  const source = await readMediaFile(input.filename, input.churchId, input.allowLegacy ?? false);
  const optimized = await optimizeImageBuffer(source, input.mimeType);
  if (!optimized) return { optimized: false, originalBytes: source.length, optimizedBytes: source.length };
  await writeFile(mediaAbsolutePath(input.filename, input.churchId), optimized);
  return { optimized: true, originalBytes: source.length, optimizedBytes: optimized.length };
}

export async function getMediaOptimizationSetting() {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const church = await db.church.findUnique({ where: { id: user.churchId }, select: { mediaOptimizationEnabled: true } });
  return { enabled: church?.mediaOptimizationEnabled === true };
}

export async function setMediaOptimizationSetting(enabled: boolean) {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  await db.church.update({ where: { id: user.churchId }, data: { mediaOptimizationEnabled: enabled } });
  return { enabled };
}

export async function optimizeExistingMediaAssets() {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const assets = await db.mediaAsset.findMany({
    where: { churchId: user.churchId, mimeType: { startsWith: "image/" } },
    select: { id: true, storedFilename: true, mimeType: true, sizeBytes: true, url: true }
  });
  let optimized = 0;
  let savedBytes = 0;
  let failed = 0;
  for (const asset of assets) {
    try {
      const result = await optimizeMediaAssetFile({
        filename: asset.storedFilename,
        churchId: user.churchId,
        mimeType: asset.mimeType,
        allowLegacy: isLegacyMediaUrl(asset.url)
      });
      if (!result.optimized) continue;
      await db.mediaAsset.update({ where: { id: asset.id }, data: { sizeBytes: result.optimizedBytes } });
      optimized += 1;
      savedBytes += result.originalBytes - result.optimizedBytes;
    } catch {
      failed += 1;
    }
  }
  return { scanned: assets.length, optimized, failed, savedBytes };
}

function isLegacyMediaUrl(url: string) {
  return url.startsWith("/api/media/upload?file=");
}

export function inferMediaMimeType(filename: string) {
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  return extensionMimeTypes.get(extension) ?? "application/octet-stream";
}

export function parseMediaByteRange(value: string | null, size: number) {
  if (!value) return undefined;
  if (!Number.isInteger(size) || size <= 0 || !value.startsWith("bytes=")) return null;
  const range = value.slice("bytes=".length).split(",")[0]?.trim() ?? "";
  const separator = range.indexOf("-");
  if (separator < 0) return null;
  const startValue = range.slice(0, separator).trim();
  const endValue = range.slice(separator + 1).trim();
  if (!startValue && !endValue) return null;

  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(startValue);
  if (!Number.isInteger(start) || start < 0 || start >= size) return null;
  const requestedEnd = endValue ? Number(endValue) : size - 1;
  if (!Number.isInteger(requestedEnd) || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export function mediaTypeFromMimeType(mimeType: string): Exclude<MediaFilter, "all"> {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("application/") || mimeType.startsWith("text/")) return "document";
  return "other";
}

export async function createUploadedMediaAsset(input: {
  churchId: string;
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
  const buffer = await readFile(mediaAbsolutePath(input.storedFilename, input.churchId)).catch(() => null);
  const dimensions = input.mimeType.startsWith("image/") && buffer ? await imageDimensions(buffer) : {};
  const embedded = input.mimeType.startsWith("image/") && buffer ? await embeddedImageMetadata(buffer) : {};
  const folder = folderForDate(new Date());
  return db.mediaAsset.create({
    data: {
      originalName: input.originalName,
      storedFilename: input.storedFilename,
      churchId: input.churchId,
      url: mediaServeUrl(input.storedFilename, input.churchId),
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

export async function listMediaAssets(input: { search?: string | null; type?: MediaFilter; linked?: MediaLinkedFilter; folder?: string | null; generated?: "all" | "generated" | "standard"; permission?: "EDIT_PAGES" | "MANAGE_SETTINGS" }) {
  const user = await requirePermission(input.permission ?? "EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  await syncLegacyMediaAssets(user.churchId);
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
    where: { churchId: user.churchId, ...(filters.length ? { AND: filters } : {}) },
    include: mediaInclude,
    orderBy: [{ createdAt: "desc" }, { originalName: "asc" }]
  });
  const linkedPages = await linkedPagesByUrl(user.churchId);
  return assets.map((asset) => serializeMediaAsset(asset, linkedPages.get(asset.url) ?? [])).filter((asset) => input.linked === "linked" ? asset.linkedPages.length > 0 : input.linked === "unlinked" ? asset.linkedPages.length === 0 : true);
}

export async function backfillEmbeddedMediaMetadata() {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const assets = await db.mediaAsset.findMany({
    where: { churchId: user.churchId,
      mimeType: { startsWith: "image/" },
      OR: [{ caption: null }, { description: null }]
    },
    select: { id: true, storedFilename: true, caption: true, description: true }
  });
  let updated = 0;
  for (const asset of assets) {
    const file = await readMediaFile(asset.storedFilename, user.churchId, true).catch(() => null);
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
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const folders = await db.mediaAsset.groupBy({
    by: ["folder"],
    where: { churchId: user.churchId },
    _count: { _all: true },
    orderBy: { folder: "asc" }
  });
  return folders.map((folder) => ({ name: folder.folder, count: folder._count._all }));
}

export async function mergeMediaFolders(from: string, to: string) {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  if (!from || !to || from === to || from.length > 80 || to.length > 80) throw new Error("Choose two different valid folders.");
  const result = await db.mediaAsset.updateMany({ where: { churchId: user.churchId, folder: from }, data: { folder: to } });
  return { moved: result.count, from, to };
}

export async function updateMediaAsset(id: string, input: MediaAssetUpdateInput) {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const existing = await db.mediaAsset.findFirst({ where: { id, churchId: user.churchId }, select: { id: true } });
  if (!existing) throw new Error("Media asset not found.");
  const asset = await db.mediaAsset.update({
    where: { id: existing.id },
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
  return serializeMediaAsset(asset, (await linkedPagesByUrl(user.churchId)).get(asset.url) ?? []);
}

export async function deleteMediaAsset(id: string) {
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const asset = await db.mediaAsset.findFirst({ where: { id, churchId: user.churchId }, select: { id: true, churchId: true, storedFilename: true, url: true } });
  if (!asset) throw new Error("Media asset not found.");
  const linked = (await linkedPagesByUrl(user.churchId)).get(asset.url) ?? [];
  if (linked.length) throw new Error(`Cannot delete linked media asset. It is used by: ${linked.map((page) => page.title).join(", ")}.`);
  await db.mediaAsset.delete({ where: { id } });
  await unlink(isLegacyMediaUrl(asset.url) ? mediaAbsolutePath(asset.storedFilename) : mediaAbsolutePath(asset.storedFilename, asset.churchId)).catch(() => undefined);
  await unlink(mediaAbsolutePath(mediaThumbnailFilename(asset.storedFilename), asset.churchId)).catch(() => undefined);
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
  if (!input.uploader?.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const churchId = input.uploader.churchId;
  const buffer = Buffer.from(await input.asset.arrayBuffer());
  await mkdir(path.join(mediaDirectory, churchId), { recursive: true });
  const storedFilename = input.filename;
  const church = await db.church.findUnique({ where: { id: churchId }, select: { mediaOptimizationEnabled: true } });
  const optimized = input.asset.type.startsWith("image/") && church?.mediaOptimizationEnabled
    ? await optimizeImageBuffer(buffer, input.asset.type)
    : null;
  const storedBuffer = optimized ?? buffer;
  await writeFile(mediaAbsolutePath(storedFilename, churchId), storedBuffer);
  try {
    return await createUploadedMediaAsset({
      originalName: input.asset.name,
      churchId,
      storedFilename,
      mimeType: input.asset.type,
      sizeBytes: storedBuffer.length,
      uploaderId: input.uploader?.id ?? null,
      altText: input.altText ?? null,
      title: input.title ?? null,
      caption: input.caption ?? null,
      description: input.description ?? null,
      tags: input.tags ?? []
    });
  } catch (error) {
    await unlink(mediaAbsolutePath(storedFilename, churchId)).catch(() => undefined);
    throw error;
  }
}

export async function readMediaFile(filename: string, churchId: string, allowLegacy = false) {
  try {
    return await readFile(mediaAbsolutePath(filename, churchId));
  } catch (error) {
    if (!allowLegacy) throw error;
    return readFile(mediaAbsolutePath(filename));
  }
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
  const user = await requirePermission("EDIT_PAGES");
  if (!user.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const source = await db.mediaAsset.findFirst({ where: { id: input.assetId, churchId: user.churchId } });
  if (!source) throw new Error("Media asset not found.");
  if (!source.mimeType.startsWith("image/") || source.mimeType === "image/gif") throw new Error("Only PNG, JPEG, and WebP images can be edited.");

  const sourceBuffer = await readMediaFile(source.storedFilename, source.churchId, isLegacyMediaUrl(source.url)).catch(() => null);
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
  await mkdir(path.join(mediaDirectory, user.churchId), { recursive: true });
  await writeFile(mediaAbsolutePath(filename, user.churchId), output);
  try {
    return await createUploadedMediaAsset({
      originalName: `${source.originalName.replace(/\.[^.]+$/, "")}-edited.png`,
      churchId: user.churchId,
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
    await unlink(mediaAbsolutePath(filename, user.churchId)).catch(() => undefined);
    throw error;
  }
}

async function syncLegacyMediaAssets(churchId: string) {
  const fallbackChurch = await db.church.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
  if (fallbackChurch?.id !== churchId) return;
  const existing = await readdir(mediaDirectory, { withFileTypes: true }).catch(() => []);
  const legacyFiles = existing.filter((entry) => entry.isFile() && extensionMimeTypes.has(fileExtension(entry.name)));
  if (!legacyFiles.length) return;
  const known = new Set((await db.mediaAsset.findMany({ select: { storedFilename: true } })).map((item) => item.storedFilename));
  const missing = legacyFiles.filter((entry) => !known.has(entry.name));
  if (!missing.length) return;
  const records = await Promise.all(missing.map(async (entry) => {
    const legacyPath = mediaAbsolutePath(entry.name);
    const tenantPath = mediaAbsolutePath(entry.name, churchId);
    await mkdir(path.dirname(tenantPath), { recursive: true });
    await rename(legacyPath, tenantPath);
    const file = await stat(tenantPath);
    const dimensions = inferMediaMimeType(entry.name).startsWith("image/") ? await imageDimensions(await readFile(tenantPath)) : {};
    return {
      originalName: entry.name,
      storedFilename: entry.name,
      churchId,
      url: mediaServeUrl(entry.name, churchId),
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
  return { ...asset, linkedPages, mediaType: mediaTypeFromMimeType(asset.mimeType), ...(asset.mimeType.startsWith("image/") ? { thumbnailUrl: mediaThumbnailServeUrl(asset.storedFilename, asset.churchId) } : {}) };
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

async function linkedPagesByUrl(churchId: string) {
  const pages = await db.page.findMany({ where: { churchId }, select: { id: true, title: true, slug: true, blocks: true } });
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
