import Link from "next/link";

type MenuItem = { id: string; label: string; href: string; position: number; parentId: string | null; openInNewTab: boolean };

export function MenuLinks({ items }: { items: MenuItem[] }) {
  return <ul className="flex flex-wrap gap-4">{items.filter((item) => !item.parentId).map((item) => <MenuLink key={item.id} item={item} items={items} />)}</ul>;
}

function MenuLink({ item, items }: { item: MenuItem; items: MenuItem[] }) {
  const children = items.filter((child) => child.parentId === item.id);
  return <li className="relative"><Link href={item.href} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noreferrer" : undefined} className="focus-ring hover:text-coral">{item.label}</Link>{children.length > 0 && <ul className="mt-2 grid gap-2 border-l border-ink/15 pl-4 text-sm">{children.map((child) => <MenuLink key={child.id} item={child} items={items} />)}</ul>}</li>;
}
