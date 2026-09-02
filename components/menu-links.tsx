"use client";

import Link from "next/link";
import { useState } from "react";

type MenuItem = { id: string; label: string; href: string; position: number; parentId: string | null; openInNewTab: boolean };

export function MenuLinks({ items }: { items: MenuItem[] }) {
  return <ul className="flex flex-wrap gap-4">{items.filter((item) => !item.parentId).map((item) => <MenuLink key={item.id} item={item} items={items} />)}</ul>;
}

function MenuLink({ item, items }: { item: MenuItem; items: MenuItem[] }) {
  const children = items.filter((child) => child.parentId === item.id);
  const [expanded, setExpanded] = useState(false);
  return <li className="relative">
    <div className="flex items-center gap-1">
      <Link href={item.href} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noreferrer" : undefined} className="focus-ring hover:text-coral">{item.label}</Link>
      {children.length > 0 && <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`} className="focus-ring rounded px-1 text-ink/60 hover:bg-mist hover:text-coral" onClick={() => setExpanded((current) => !current)}>{expanded ? "⌃" : "⌄"}</button>}
    </div>
    {children.length > 0 && expanded && <ul className="mt-2 grid gap-2 border-l border-ink/15 pl-4 text-sm">{children.map((child) => <MenuLink key={child.id} item={child} items={items} />)}</ul>}
  </li>;
}
