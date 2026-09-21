import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", signature: (bytes: Uint8Array) => bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10" }],
  ["image/webp", { extension: "webp", signature: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP" }]
]);
const storageDirectory = path.join(process.cwd(), "storage", "global-announcement-assets");

export function validateGlobalAnnouncementImage(name: string, mimeType: string, bytes: Uint8Array) {
  const type = IMAGE_TYPES.get(mimeType);
  if (!type || !bytes.length || bytes.length > MAX_IMAGE_BYTES || !/^[^<>:"/\\|?*]+$/.test(name) || !type.signature(bytes)) {
    throw new Error("Choose a valid JPG, PNG, or WebP image no larger than 10 MB.");
  }
  return { extension: type.extension, originalName: name.slice(0, 200) };
}

export async function saveGlobalAnnouncementImage(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateGlobalAnnouncementImage(file.name, file.type, bytes);
  const filename = `${randomUUID()}.${validation.extension}`;
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(path.join(storageDirectory, filename), bytes, { flag: "wx" });
  return { filename, url: `/api/global-admin/announcement-assets?file=${encodeURIComponent(filename)}` };
}

export async function readGlobalAnnouncementImage(filename: string) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename)) throw new Error("Invalid announcement image.");
  return readFile(path.join(storageDirectory, filename));
}

export const globalAnnouncementImageMimeTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
