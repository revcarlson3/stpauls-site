"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container } from "@/components/ui";

type Family = {
  lastName: string;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  formalGreeting: string | null;
  informalGreeting: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
};

const fields: { key: keyof Family; label: string; type?: string }[] = [
  { key: "lastName", label: "Family last name" },
  { key: "phone", label: "Family phone", type: "tel" },
  { key: "email", label: "Family email", type: "email" },
  { key: "formalGreeting", label: "Formal greeting" },
  { key: "informalGreeting", label: "Informal greeting" },
  { key: "addressStreet", label: "Street" },
  { key: "addressCity", label: "City" },
  { key: "addressState", label: "State" },
  { key: "addressZip", label: "ZIP + 4" }
];

export default function EditFamilyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch(`/api/membership/families/${params.id}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load family.");
        setFamily(body.family);
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.id]);

  function change(key: keyof Family, value: string) {
    setFamily((current) => current ? { ...current, [key]: value } : current);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family) return;
    const response = await fetch(`/api/membership/families/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(family)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to save family.");
      return;
    }
    router.push("/admin/membership");
  }

  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Edit family</h1>{family ? <form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-2xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">{fields.map(({ key, label, type }) => <label key={key} className="grid gap-1 text-sm font-semibold">{label}<input required={key === "lastName" || key === "phone" || key === "email"} type={type ?? "text"} value={family[key] ?? ""} onChange={(event) => change(key, event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>)}<label className="grid gap-1 text-sm font-semibold">Family status<select value={family.status} onChange={(event) => change("status", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Save family</button>{message && <p role="alert" className="text-sm text-coral">{message}</p>}</form> : <p className="mt-6 text-sm text-coral" role="alert">{message || "Loading family..."}</p>}</Container></main>;
}
