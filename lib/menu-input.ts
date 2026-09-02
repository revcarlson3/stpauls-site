export type MenuItemInput = {
  id?: string;
  label: string;
  href: string;
  position: number;
  parentId?: string | null;
  itemType: "INTERNAL" | "EXTERNAL";
  openInNewTab: boolean;
};

export function parseMenuDetails(value: unknown): { name: string; slug: string } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.slug !== "string" || !input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) return null;
  return { name: input.name.trim(), slug: input.slug };
}

export function parseMenuInput(value: unknown): { name: string; slug: string; items: MenuItemInput[] } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.name !== "string" ||
    typeof input.slug !== "string" ||
    !input.name.trim() ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
    !Array.isArray(input.items)
  ) {
    return null;
  }

  const items = input.items.map(parseMenuItem);
  if (items.some((item) => item === null)) return null;
  return { name: input.name.trim(), slug: input.slug, items: items as MenuItemInput[] };
}

function parseMenuItem(value: unknown): MenuItemInput | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.label !== "string" || !item.label.trim() || typeof item.href !== "string" || !item.href.trim() || typeof item.position !== "number") return null;
  const itemType = item.itemType === "EXTERNAL" ? "EXTERNAL" : item.itemType === "INTERNAL" ? "INTERNAL" : null;
  if (!itemType || typeof item.openInNewTab !== "boolean") return null;
  if (itemType === "INTERNAL" && !item.href.startsWith("/")) return null;
  if (itemType === "EXTERNAL" && !/^https?:\/\//i.test(item.href)) return null;
  if (item.id !== undefined && typeof item.id !== "string") return null;
  if (item.parentId !== undefined && item.parentId !== null && typeof item.parentId !== "string") return null;
  return {
    id: item.id as string | undefined,
    label: item.label.trim(),
    href: item.href.trim(),
    position: item.position,
    parentId: item.parentId as string | null | undefined,
    itemType,
    openInNewTab: item.openInNewTab
  };
}
