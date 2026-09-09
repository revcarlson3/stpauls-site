export type MediaFilter = "all" | "image" | "video" | "audio" | "document" | "other";
export type MediaLinkedFilter = "all" | "linked" | "unlinked";

export type MediaAssetUpdateInput = {
  folder?: string;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  tags?: string[];
};

const mediaFilters = new Set<MediaFilter>(["all", "image", "video", "audio", "document", "other"]);

export function parseMediaFilter(value: string | null | undefined): MediaFilter {
  return value && mediaFilters.has(value as MediaFilter) ? value as MediaFilter : "all";
}

export function parseMediaLinkedFilter(value: string | null | undefined): MediaLinkedFilter {
  return value === "linked" || value === "unlinked" ? value : "all";
}

export function parseMediaAssetUpdateInput(value: unknown): MediaAssetUpdateInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.folder !== undefined && (typeof input.folder !== "string" || input.folder.trim().length > 80)) return null;
  if (input.altText !== undefined && input.altText !== null && typeof input.altText !== "string") return null;
  if (input.title !== undefined && input.title !== null && typeof input.title !== "string") return null;
  if (input.caption !== undefined && input.caption !== null && typeof input.caption !== "string") return null;
  if (input.description !== undefined && input.description !== null && typeof input.description !== "string") return null;
  if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== "string"))) return null;
  return {
    folder: input.folder === undefined ? undefined : input.folder.trim() || "unfiled",
    altText: normalizeOptionalText(input.altText),
    title: normalizeOptionalText(input.title),
    caption: normalizeOptionalText(input.caption),
    description: normalizeOptionalText(input.description),
    tags: input.tags === undefined ? undefined : normalizeTags(input.tags)
  };
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : value === null ? null : undefined;
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
