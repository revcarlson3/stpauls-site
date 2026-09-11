import Link from "next/link";
import { Card, Container } from "@/components/ui";

export default function MemberSchedulingPage() {
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Card>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p>
    <h1 className="mt-2 font-serif text-4xl">Scheduling</h1>
    <p className="mt-4 leading-7 text-ink/60">Your volunteer groups and upcoming scheduled events will appear here when member scheduling is connected to your account.</p>
    <Link href="/account/membership" className="focus-ring mt-6 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link>
  </Card></Container></main>;
}
