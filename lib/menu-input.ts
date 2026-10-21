export type MenuItemInput = {
  id?: string;
  label: string;
  href: string;
  position: number;
  parentId?: string | null;
  itemType: "INTERNAL" | "EXTERNAL";
  openInNewTab: boolean;
};

type MenuTreeItem = { id?: string; tempId?: string; parentId?: string | null; position: number };

type PageMenuLink = { id: string; title: string; slug: string; menuId: string | null; isHome: boolean };
type PageMenu = { id: string; items: (MenuTreeItem & { href: string; label?: string })[] };

function normalizedMenuLabel(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function orderMenuItems<T extends MenuTreeItem>(items: T[]) {
  const byKey = new Map(items.flatMap((item) => {
    const key = item.id ?? item.tempId;
    return key ? [[key, item] as const] : [];
  }));
  const children = new Map<string, T[]>();
  for (const item of items) {
    if (!item.parentId || !byKey.has(item.parentId)) continue;
    const group = children.get(item.parentId) ?? [];
    group.push(item);
    children.set(item.parentId, group);
  }

  children.forEach((group) => group.sort((left, right) => left.position - right.position));

  const ordered: { item: T; depth: number }[] = [];
  const visited = new Set<string>();
  function visit(item: T, depth: number) {
    const key = item.id ?? item.tempId;
    if (!key || visited.has(key)) return;
    visited.add(key);
    ordered.push({ item, depth });
    for (const child of children.get(key) ?? []) visit(child, depth + 1);
  }

  const roots = items
    .filter((item) => !item.parentId || !byKey.has(item.parentId))
    .sort((left, right) => left.position - right.position);
  for (const item of roots) visit(item, 0);
  for (const item of items) visit(item, 0);
  return ordered;
}

export function orderPagesByMenus<T extends PageMenuLink>(pages: T[], menus: PageMenu[]) {
  const pageByPath = new Map(pages.flatMap((page) => {
    const paths = [page.isHome ? "/" : `/${page.slug}`.replace(/\/+$/, "") || "/"];
    if (page.isHome) paths.push(`/${page.slug}`.replace(/\/+$/, "") || "/");
    return paths.map((path) => [path, page] as const);
  }));
  const pageByTitle = new Map(pages.map((page) => [normalizedMenuLabel(page.title), page] as const));
  const pageBySlug = new Map(pages.map((page) => [page.slug.replace(/^\/+|\/+$/g, "").toLocaleLowerCase(), page] as const));
  const ordered: { page: T; depth: number; inMenu: boolean }[] = [];
  const seen = new Set<string>();
  for (const menu of menus) {
    for (const { item, depth } of orderMenuItems(menu.items)) {
      const rawHref = item.href.split(/[?#]/, 1)[0].trim();
      const href = rawHref ? rawHref.replace(/\/+$/, "") || "/" : null;
      const page = (href ? pageByPath.get(href) : undefined)
        ?? pageByTitle.get(normalizedMenuLabel(item.label ?? ""))
        ?? ((item.label ?? "").trim() ? pageBySlug.get((item.label ?? "").trim().replace(/^\/+|\/+$/g, "").toLocaleLowerCase()) : undefined);
      if (page && !seen.has(page.id)) {
        seen.add(page.id);
        ordered.push({ page, depth, inMenu: true });
      }
    }
  }
  pages.filter((page) => !seen.has(page.id) && page.menuId).sort((left, right) => left.title.localeCompare(right.title)).forEach((page) => {
    seen.add(page.id);
    ordered.push({ page, depth: 0, inMenu: false });
  });
  pages.filter((page) => !seen.has(page.id)).sort((left, right) => left.title.localeCompare(right.title)).forEach((page) => ordered.push({ page, depth: 0, inMenu: false }));
  return ordered;
}

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
  if (typeof item.label !== "string" || !item.label.trim() || typeof item.href !== "string" || typeof item.position !== "number") return null;
  const itemType = item.itemType === "EXTERNAL" ? "EXTERNAL" : item.itemType === "INTERNAL" ? "INTERNAL" : null;
  if (!itemType || typeof item.openInNewTab !== "boolean") return null;
  if (itemType === "INTERNAL" && item.href && !item.href.startsWith("/")) return null;
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
