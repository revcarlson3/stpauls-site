"use client";

import Link from "next/link";
import { useState } from "react";

type MenuItem = { id: string; label: string; href: string; position: number; parentId: string | null; openInNewTab: boolean };

export function MenuLinks({ items, className = "flex flex-wrap gap-4" }: { items: MenuItem[]; className?: string }) {
  return <ul className={className}>{items.filter((item) => !item.parentId).map((item) => <MenuLink key={item.id} item={item} items={items} />)}</ul>;
}

function MenuLink({ item, items }: { item: MenuItem; items: MenuItem[] }) {
  const children = items.filter((child) => child.parentId === item.id);
  const [expanded, setExpanded] = useState(false);
  const hasDestination = Boolean(item.href);
  const desktopExpanded = expanded ? "lg:visible lg:opacity-100 lg:pointer-events-auto" : "";
  return <li className="group relative">
    <div className="flex items-center gap-1">
      {hasDestination ? <Link href={item.href} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noreferrer" : undefined} className="focus-ring hover:text-coral">{item.label}</Link> : <button type="button" aria-expanded={expanded} className="focus-ring font-semibold hover:text-coral" onClick={() => setExpanded((current) => !current)}>{item.label}</button>}
      {children.length > 0 && hasDestination && <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`} className="focus-ring rounded px-1 text-ink/60 hover:bg-mist hover:text-coral lg:hidden" onClick={() => setExpanded((current) => !current)}>{expanded ? "−" : "+"}</button>}
    </div>
    {children.length > 0 && <ul className={`${expanded ? "block" : "hidden"} mt-2 grid gap-2 border-l border-ink/15 bg-white pl-4 text-sm shadow-sm lg:invisible lg:pointer-events-none lg:absolute lg:left-0 lg:top-full lg:z-10 lg:mt-0 lg:block lg:min-w-48 lg:border lg:border-ink/10 lg:p-3 lg:opacity-0 lg:transition lg:duration-200 lg:group-hover:visible lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:visible lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100 ${desktopExpanded}`}>{children.map((child) => <MenuLink key={child.id} item={child} items={items} />)}</ul>}
  </li>;
}
