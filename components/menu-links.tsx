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
  const hasDestination = Boolean(item.href);
  return <li className="group relative">
    <div className="flex items-center gap-1">
      {hasDestination ? <Link href={item.href} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noreferrer" : undefined} className="focus-ring hover:text-coral">{item.label}</Link> : <button type="button" aria-expanded={expanded} className="focus-ring font-semibold hover:text-coral" onClick={() => setExpanded((current) => !current)}>{item.label}</button>}
    </div>
    {children.length > 0 && <ul className={`${expanded ? "block" : "hidden"} mt-2 grid gap-2 border-l border-ink/15 bg-white pl-4 text-sm shadow-sm lg:absolute lg:left-0 lg:top-full lg:z-10 lg:min-w-48 lg:border lg:border-ink/10 lg:p-3 lg:group-hover:grid lg:group-focus-within:grid`}>{children.map((child) => <MenuLink key={child.id} item={child} items={items} />)}</ul>}
  </li>;
}
