import path from "path";

export const MAX_MEMBERSHIP_DOCUMENT_SIZE = 10 * 1024 * 1024;
export const MEMBERSHIP_DOCUMENT_CLEANUP_CONFIRMATION = "DELETE_EXPIRED_MEMBERSHIP_DOCUMENTS";

const documentTypes = {
  "application/pdf": { extension: ".pdf", extensions: [".pdf"] },
  "image/jpeg": { extension: ".jpg", extensions: [".jpg", ".jpeg"] },
  "image/png": { extension: ".png", extensions: [".png"] },
  "image/webp": { extension: ".webp", extensions: [".webp"] }
} as const;

export type MembershipDocumentMimeType = keyof typeof documentTypes;

export function sanitizeDocumentName(value: string) {
  const filename = value.replace(/\\/g, "/").split("/").pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() ?? "";
  return filename.slice(0, 180);
}

export function validateDocumentUpload(name: string, declaredMimeType: string, contents: Buffer) {
  const originalName = sanitizeDocumentName(name);
  if (!originalName) return { error: "The document must have a valid filename." } as const;
  if (!contents.length) return { error: "The document is empty." } as const;
  if (contents.length > MAX_MEMBERSHIP_DOCUMENT_SIZE) return { error: "Documents must be no larger than 10 MB." } as const;

  const detectedMimeType = detectMimeType(contents);
  const type = documentTypes[declaredMimeType as MembershipDocumentMimeType];
  const extension = path.extname(originalName).toLowerCase();
  if (!type || detectedMimeType !== declaredMimeType || !(type.extensions as readonly string[]).includes(extension)) {
    return { error: "Documents must be PDF, JPG, PNG, or WebP files whose contents match their file type." } as const;
  }

  return {
    originalName,
    mimeType: declaredMimeType as MembershipDocumentMimeType,
    storageExtension: type.extension
  } as const;
}

export function isSafeDocumentStorageKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/i.test(value);
}

export function documentDownloadDisposition(originalName: string) {
  const name = sanitizeDocumentName(originalName) || "document";
  const asciiName = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export function parseMembershipDocumentExpiry(value: unknown) {
  if (value === null || value === "") return { expiresAt: null } as const;
  if (typeof value !== "string") return { error: "Choose a valid expiry date or clear the expiry." } as const;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const expiresAt = dateOnly ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
  if (
    Number.isNaN(expiresAt.getTime())
    || (dateOnly && expiresAt.toISOString().slice(0, 10) !== value)
  ) {
    return { error: "Choose a valid expiry date or clear the expiry." } as const;
  }
  return { expiresAt } as const;
}

export function isMembershipDocumentExpired(expiresAt: Date | null, cutoff = new Date()) {
  return expiresAt !== null && expiresAt.getTime() <= cutoff.getTime();
}

export function parseMembershipDocumentCleanupRequest(
  input: { confirmation?: unknown; asOf?: unknown },
  now = new Date()
) {
  if (input.confirmation !== MEMBERSHIP_DOCUMENT_CLEANUP_CONFIRMATION) {
    return { error: "Explicit cleanup confirmation is required." } as const;
  }
  if (typeof input.asOf !== "string") {
    return { error: "Preview expired documents again before running cleanup." } as const;
  }

  const cutoff = new Date(input.asOf);
  if (Number.isNaN(cutoff.getTime()) || cutoff > now || now.getTime() - cutoff.getTime() > 60 * 60 * 1000) {
    return { error: "Preview expired documents again before running cleanup." } as const;
  }
  return { cutoff } as const;
}

function detectMimeType(contents: Buffer): MembershipDocumentMimeType | null {
  if (contents.length >= 5 && contents.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (contents.length >= 3 && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff) return "image/jpeg";
  if (contents.length >= 8 && contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (contents.length >= 12 && contents.subarray(0, 4).toString("ascii") === "RIFF" && contents.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
