import Link from "next/link";
import { Card, Container } from "@/components/ui";

export default function MemberDocumentsPage() {
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Card><h1 className="font-serif text-4xl">Documents and forms</h1><p className="mt-4 leading-7 text-ink/60">Member documents and forms will appear here when the shared document library is available for member access.</p><Link href="/account/membership" className="focus-ring mt-6 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Back to member center</Link></Card></Container></main>;
}
