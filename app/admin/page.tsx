import Link from "next/link";
import { listPages } from "@/lib/content";
import { Container, Card } from "@/components/ui";
import { PageActions } from "@/components/page-actions";

export default async function AdminPage() {
  const pages = await listPages();
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Overview</p><h1 className="mt-2 font-serif text-4xl">Admin Dashboard</h1><p className="mt-2 text-ink/60">Site statistics and activity will appear here as the platform grows.</p><section className="mt-10"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Pages</h2><Link href="/admin/pages/add" className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Add a Page</Link></div><div className="mt-4 grid gap-4">{pages.map((page) => <Card key={page.id} className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold">{page.title}</h3><p className="text-sm text-ink/55">/{page.slug} · {page.status.toLowerCase()}</p></div><PageActions id={page.id} status={page.status} /></Card>)}</div></section></Container></main>;
}
