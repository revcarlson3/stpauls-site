import Link from "next/link";
import { Card, Container } from "@/components/ui";

export default function GivingHistoryPage() {
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Card><h1 className="font-serif text-4xl">Giving history and pledges</h1><p className="mt-4 leading-7 text-ink/60">Giving history and pledges will be available when the Giving and Pledges module is built and connected.</p><Link href="/account/membership" className="focus-ring mt-6 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link></Card></Container></main>;
}
