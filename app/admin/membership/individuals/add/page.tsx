"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";

type Option = { id: string; name: string };

export default function AddIndividualPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [message, setMessage] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; name: string; email: string | null; memberNumber: number }[]>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  useEffect(() => {
    void Promise.all([fetch("/api/membership/individuals"), fetch("/api/membership/reference")]).then(async ([familiesResponse, referenceResponse]) => {
      const familyData = await familiesResponse.json();
      const referenceData = await referenceResponse.json();
      setFamilies(familyData.families ?? []);
      setRoles(referenceData.roles ?? []);
      setTypes(referenceData.types ?? []);
    }).catch(() => setMessage("Unable to load membership options."));
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/membership/individuals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget).entries()), confirmDuplicate }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { if (body.duplicate) setDuplicateWarning(body.candidates ?? []); setMessage(body.error ?? "Unable to create individual."); return; }
    router.push("/admin/membership");
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Add an individual</h1><p className="mt-3 max-w-2xl text-ink/60">Add a person to an existing family. Their member number is assigned automatically.</p><form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-2xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><label className="grid gap-1 text-sm font-semibold">Family<select required name="familyId" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Choose a family</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-3"><label className="grid gap-1 text-sm font-semibold">First name<input required name="firstName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Middle name<input name="middleName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Last name<input name="lastName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Birthday<input required type="date" name="birthday" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Gender<select required name="gender" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Choose gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label><label className="grid gap-1 text-sm font-semibold">Member type<select required name="memberTypeId" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Choose type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Family role<select required name="familyRoleId" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Choose role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Email<input type="email" name="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Cellphone<input type="tel" name="cellphone" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Marital status<input required name="maritalStatus" placeholder="Single, married, etc." className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Wedding date<input type="date" name="weddingDate" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue="ACTIVE" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>{duplicateWarning.length > 0 && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p className="font-semibold">Possible duplicate individual</p><p className="mt-1">Review these existing records before continuing:</p><ul className="mt-2 grid gap-1">{duplicateWarning.map((candidate) => <li key={candidate.id}>{candidate.name} · #{candidate.memberNumber}{candidate.email ? ` (${candidate.email})` : ""}</li>)}</ul><label className="mt-3 flex items-center gap-2 font-semibold"><input type="checkbox" checked={confirmDuplicate} onChange={(event) => setConfirmDuplicate(event.target.checked)} /> This is a different person; create them anyway</label></div>}<button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Save individual</button>{message && <p role="alert" className="text-sm text-coral">{message}</p>}</form></Container></main>;
}
