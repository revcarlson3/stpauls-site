"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";

export default function AddFamilyPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/membership", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to create family."); return; }
    router.push("/admin/membership");
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Add a family</h1><p className="mt-3 max-w-2xl text-ink/60">The first person is created as the Head of Household. Additional family members can be added after the family is saved.</p><form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-2xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Family last name<input required name="lastName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Head of Household first name<input required name="firstName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><label className="grid gap-1 text-sm font-semibold">Birthday<input required type="date" name="birthday" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Family phone<input required type="tel" name="phone" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Family email<input required type="email" name="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Street<input name="addressStreet" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">City<input name="addressCity" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">State<input name="addressState" defaultValue="MN" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">ZIP + 4<input name="addressZip" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><label className="grid gap-1 text-sm font-semibold">Family status<select name="status" defaultValue="ACTIVE" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Save family</button>{message && <p role="alert" className="text-sm text-coral">{message}</p>}</form></Container></main>;
}
