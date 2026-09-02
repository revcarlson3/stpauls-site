import type { PageBlock } from "@/lib/content";

export type PageInput = {
  title: string;
  slug: string;
  blocks: PageBlock[];
  menuId?: string | null;
};

export function parsePageInput(value: unknown): PageInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.title !== "string" ||
    typeof input.slug !== "string" ||
    !Array.isArray(input.blocks) ||
    !input.title.trim() ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)
  ) {
    return null;
  }

  const blocks = input.blocks.filter(isPageBlock);
  if (blocks.length !== input.blocks.length) return null;
  if (input.menuId !== undefined && input.menuId !== null && typeof input.menuId !== "string") return null;
  return { title: input.title.trim(), slug: input.slug, blocks, menuId: input.menuId as string | null | undefined };
}

function isPageBlock(value: unknown): value is PageBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  return typeof block.id === "string" && typeof block.type === "string" && isJsonObject(block.props);
}

function isJsonObject(value: unknown): value is Record<string, never> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
