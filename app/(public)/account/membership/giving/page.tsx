import Link from "next/link";
import { Card, Container } from "@/components/ui";

export default function OnlineGivingPage() {
  const givingUrl = process.env.NEXT_PUBLIC_TITHELY_GIVING_URL;
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Card>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p>
    <h1 className="mt-2 font-serif text-4xl">Online giving</h1>
    {givingUrl ? <><p className="mt-4 leading-7 text-ink/60">Give securely through Tithe.ly.</p><a href={givingUrl} target="_blank" rel="noreferrer" className="focus-ring mt-6 inline-block rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Open Tithe.ly giving</a></> : <p className="mt-4 leading-7 text-ink/60">Online giving is not configured yet. An administrator can add the church’s Tithe.ly giving URL before this feature is used.</p>}
    <Link href="/account/membership" className="focus-ring mt-6 ml-3 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link>
  </Card></Container></main>;
}
