import { unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

export const CLERGY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const CLERGY_PHOTO_MIN_DIMENSION = 100;
export const CLERGY_PHOTO_MAX_DIMENSION = 4000;

export async function prepareClergyPhoto(file: File) {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > CLERGY_PHOTO_MAX_BYTES) {
    throw new Error("Clergy photographs must be JPG or PNG files no larger than 5 MB.");
  }
  const contents = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(contents).metadata().catch(() => null);
  const expectedFormat = file.type === "image/png" ? "png" : "jpeg";
  if (!metadata?.width || !metadata.height || metadata.format !== expectedFormat || metadata.width < CLERGY_PHOTO_MIN_DIMENSION || metadata.height < CLERGY_PHOTO_MIN_DIMENSION || metadata.width > CLERGY_PHOTO_MAX_DIMENSION || metadata.height > CLERGY_PHOTO_MAX_DIMENSION) {
    throw new Error(`Clergy photographs must be between ${CLERGY_PHOTO_MIN_DIMENSION}x${CLERGY_PHOTO_MIN_DIMENSION} and ${CLERGY_PHOTO_MAX_DIMENSION}x${CLERGY_PHOTO_MAX_DIMENSION} pixels.`);
  }
  return { filename: `${randomUUID()}${file.type === "image/png" ? ".png" : ".jpg"}`, contents };
}

export function clergyPhotoPath(filename: string) {
  return path.join(process.cwd(), "storage", "services", "clergy", filename);
}

export async function removeClergyPhoto(value: string | null) {
  if (!value) return;
  try {
    const filename = new URL(value, "http://localhost").searchParams.get("file");
    if (filename && /^[a-zA-Z0-9-]+\.(jpg|png)$/.test(filename)) {
      await unlink(clergyPhotoPath(filename)).catch(() => undefined);
    }
  } catch {
    // Ignore malformed legacy paths while removing the database reference.
  }
}
