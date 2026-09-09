import type { PageBlock } from "@/lib/content";

export type PageInput = {
  title: string;
  slug: string;
  blocks: PageBlock[];
  menuId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  publishAt?: string | null;
  pageThemeFamily?: string | null;
  pageThemeWidth?: string | null;
  showHeader?: boolean;
  showFooter?: boolean;
  fullScreen?: boolean;
  expectedUpdatedAt?: string;
  accessPassword?: string | null;
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
  const optionalStrings = ["seoTitle", "seoDescription", "seoKeywords", "pageThemeFamily", "pageThemeWidth"];
  if (optionalStrings.some((key) => input[key] !== undefined && input[key] !== null && typeof input[key] !== "string")) return null;
  if (input.publishAt !== undefined && input.publishAt !== null && (typeof input.publishAt !== "string" || Number.isNaN(Date.parse(input.publishAt)))) return null;
  if (input.showHeader !== undefined && typeof input.showHeader !== "boolean") return null;
  if (input.showFooter !== undefined && typeof input.showFooter !== "boolean") return null;
  if (input.fullScreen !== undefined && typeof input.fullScreen !== "boolean") return null;
  if (input.expectedUpdatedAt !== undefined && (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt)))) return null;
  if (input.accessPassword !== undefined && input.accessPassword !== null && (typeof input.accessPassword !== "string" || input.accessPassword.length < 8 || input.accessPassword.length > 128)) return null;
  return { title: input.title.trim(), slug: input.slug, blocks, menuId: input.menuId as string | null | undefined, seoTitle: input.seoTitle as string | null | undefined, seoDescription: input.seoDescription as string | null | undefined, seoKeywords: input.seoKeywords as string | null | undefined, publishAt: input.publishAt as string | null | undefined, pageThemeFamily: input.pageThemeFamily as string | null | undefined, pageThemeWidth: input.pageThemeWidth as string | null | undefined, showHeader: input.showHeader as boolean | undefined, showFooter: input.showFooter as boolean | undefined, fullScreen: input.fullScreen as boolean | undefined, expectedUpdatedAt: input.expectedUpdatedAt as string | undefined, accessPassword: input.accessPassword as string | null | undefined };
}

function isPageBlock(value: unknown): value is PageBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  if (typeof block.id !== "string" || typeof block.type !== "string" || !isJsonObject(block.props)) return false;
  if (block.type === "container" || block.type === "flex" || block.type === "grid") {
    const children: unknown = block.props.children;
    if (children !== undefined && (!Array.isArray(children) || !children.every(isPageBlock))) return false;
  }
  return true;
}

function isJsonObject(value: unknown): value is Record<string, never> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
