import Link from "next/link";
import { Card, Container } from "@/components/ui";

export default function PrayerRequestsPage() {
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Card>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p>
    <h1 className="mt-2 font-serif text-4xl">Prayer requests</h1>
    <p className="mt-4 leading-7 text-ink/60">Prayer request submission and request history will appear here when the shared Prayer Requests feature is enabled.</p>
    <Link href="/account/membership" className="focus-ring mt-6 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link>
  </Card></Container></main>;
}
