"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type MenuItem = { id: string; label: string; href: string; position: number; parentId: string | null; openInNewTab: boolean };

export function MenuLinks({ items, className = "flex flex-wrap gap-4" }: { items: MenuItem[]; className?: string }) {
  return <ul className={className}>{items.filter((item) => !item.parentId).map((item) => <MenuLink key={item.id} item={item} items={items} />)}</ul>;
}

function isActivePath(href: string, pathname: string) {
  if (!href.startsWith("/")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hasActiveDescendant(itemId: string, items: MenuItem[], pathname: string, visited = new Set<string>()): boolean {
  if (visited.has(itemId)) return false;
  visited.add(itemId);
  return items
    .filter((item) => item.parentId === itemId)
    .some((item) => isActivePath(item.href, pathname) || hasActiveDescendant(item.id, items, pathname, visited));
}

function MenuLink({ item, items, depth = 0 }: { item: MenuItem; items: MenuItem[]; depth?: number }) {
  const children = items.filter((child) => child.parentId === item.id);
  const hasDestination = Boolean(item.href);
  const pathname = usePathname();
  const active = hasDestination && isActivePath(item.href, pathname);
  const childActive = hasActiveDescendant(item.id, items, pathname);
  const [expanded, setExpanded] = useState(active || childActive);
  const submenuId = `submenu-${item.id}`;
  const menuItemClass = depth > 0
    ? "rounded-lg px-4 py-3 leading-snug transition-colors hover:bg-mist hover:text-coral"
    : "rounded-lg px-2 py-2 transition-colors hover:text-coral";
  useEffect(() => {
    if (active || childActive) setExpanded(true);
  }, [active, childActive]);
  return <li className="group relative">
    <div className="flex items-center gap-1">
      {hasDestination ? <Link href={item.href} aria-current={active ? "page" : undefined} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noreferrer" : undefined} className={`focus-ring ${menuItemClass} ${active || childActive ? "text-coral" : ""}`}>{item.label}</Link> : <button type="button" aria-expanded={expanded} aria-controls={submenuId} aria-haspopup="true" className={`focus-ring ${menuItemClass} font-semibold ${childActive ? "text-coral" : ""}`} onClick={() => setExpanded((current) => !current)}>{item.label}</button>}
      {children.length > 0 && hasDestination && <button type="button" aria-expanded={expanded} aria-controls={submenuId} aria-haspopup="true" aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`} className="focus-ring rounded px-1 text-ink/60 hover:bg-mist hover:text-coral lg:hidden" onClick={() => setExpanded((current) => !current)}>{expanded ? "−" : "+"}</button>}
    </div>
    {children.length > 0 && <ul id={submenuId} className={`${expanded ? "block" : "hidden"} mt-3 grid gap-1.5 border-l border-ink/15 bg-white pl-4 text-base shadow-sm lg:invisible lg:pointer-events-none lg:absolute lg:z-10 lg:mt-0 lg:block lg:min-w-64 lg:rounded-xl lg:border lg:border-ink/10 lg:bg-white lg:p-3 lg:shadow-xl lg:opacity-0 lg:translate-y-1 lg:transition-[opacity,transform] lg:duration-200 lg:group-hover:visible lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-hover:translate-y-0 lg:group-focus-within:visible lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100 ${depth > 0 ? "lg:left-full lg:top-0 lg:ml-2" : "lg:left-0 lg:top-full"}`}>{children.map((child) => <MenuLink key={child.id} item={child} items={items} depth={depth + 1} />)}</ul>}
  </li>;
}
