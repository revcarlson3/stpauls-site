import Link from "next/link";
import { Card, Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PrayerRequestForm } from "./prayer-request-form";

export default async function PrayerRequestsPage() {
  const user = await getCurrentUser();
  if (!user) return <main className="py-12"><Container><Card><h1 className="font-serif text-3xl">Sign in required</h1><Link href="/account" className="mt-4 inline-block text-coral">Go to account</Link></Card></Container></main>;
  const requests = await db.prayerRequest.findMany({ where: { status: "APPROVED", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, submitterName: true, request: true, createdAt: true, expiresAt: true } });
  return <main className="py-12 sm:py-16"><Container><div className="grid gap-8 lg:grid-cols-2">
    <Card><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p><h1 className="mt-2 font-serif text-4xl">Prayer requests</h1><p className="mt-3 text-sm text-ink/60">Approved requests currently being held in prayer.</p><div className="mt-6 grid gap-4">{requests.length ? requests.map((item) => <article key={item.id} className="border-b border-ink/10 pb-4"><p className="leading-7">{item.request}</p><p className="mt-2 text-xs text-ink/55">— {item.submitterName}</p></article>) : <p className="text-sm text-ink/60">There are no active approved requests.</p>}</div></Card>
    <Card><h2 className="font-serif text-3xl">Share a request</h2><p className="mt-3 text-sm text-ink/60">New requests are reviewed before they appear here.</p><div className="mt-6"><PrayerRequestForm name={user.name} /></div></Card>
  </div></Container></main>;
}
