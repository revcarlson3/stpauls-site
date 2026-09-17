import Link from "next/link";
import { notFound } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";
import { Card, Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function MemberFormPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return <main className="py-12"><Container><Card><h1 className="font-serif text-3xl">Sign in required</h1><Link href="/account" className="focus-ring mt-4 inline-block text-coral">Go to account</Link></Card></Container></main>;
  if (!user.permissions.includes("MY_MEMBERSHIP")) notFound();
  const form = await db.form.findFirst({ where: { id: params.id, enabled: true, status: "PUBLISHED", audience: { in: ["PUBLIC", "MEMBERS"] } }, select: { id: true, name: true } });
  if (!form) notFound();
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Link href="/account/membership/documents" className="focus-ring text-sm font-semibold text-coral">← Documents and forms</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member form</p><h1 className="mt-2 font-serif text-4xl">{form.name}</h1><div className="mt-8"><FormRenderer formId={form.id} /></div></Container></main>;
}
