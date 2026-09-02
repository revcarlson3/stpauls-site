import Link from "next/link";
import { listPages } from "@/lib/content";
import { PageActions } from "@/components/page-actions";
import { Card, Container } from "@/components/ui";

export default async function PagesPage() {
  const pages = await listPages();
  return <main><Container className="py-10 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Content</p><h1 className="mt-2 font-serif text-4xl">Pages</h1><p className="mt-2 text-ink/60">Manage page drafts, published pages, and archived content.</p></div><Link href="/admin/pages/add" className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Add a Page</Link></div><div className="mt-8 grid gap-4">{pages.length === 0 && <Card><p className="text-ink/60">No pages have been created yet.</p></Card>}{pages.map((page) => <Card key={page.id} className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl">{page.title}</h2><p className="mt-1 text-sm text-ink/55">/{page.slug} · {page.status.toLowerCase()} {page.isHome ? "· home page" : ""}</p></div><PageActions id={page.id} status={page.status} isHome={page.isHome} /></Card>)}</div></Container></main>;
}
