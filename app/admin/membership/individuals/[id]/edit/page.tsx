"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container } from "@/components/ui";
import { MARITAL_STATUSES } from "@/lib/modules";

export default function EditIndividualPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, string>>({});
  const [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void Promise.all([fetch(`/api/membership?id=${params.id}`), fetch("/api/membership/individuals"), fetch("/api/membership/reference")]).then(async ([memberResponse, familyResponse, referenceResponse]) => {
      const member = (await memberResponse.json()).selected;
      const familyData = await familyResponse.json();
      const referenceData = await referenceResponse.json();
      setData({ ...member, familyId: member.family.id, memberTypeId: member.memberType.id, familyRoleId: member.familyRole.id, birthday: member.birthday.slice(0, 10), weddingDate: member.weddingDate?.slice(0, 10) ?? "" });
      setFamilies(familyData.families ?? []); setRoles(referenceData.roles ?? []); setTypes(referenceData.types ?? []);
    }).catch(() => setMessage("Unable to load individual."));
  }, [params.id]);
  function change(key: string, value: string) { setData((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/membership/individuals/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to save individual."); return; }
    router.push("/admin/membership");
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Edit individual</h1><form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-2xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><label className="grid gap-1 text-sm font-semibold">Family<select value={data.familyId ?? ""} onChange={(event) => change("familyId", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-3">{["firstName", "middleName", "lastName"].map((key) => <label key={key} className="grid gap-1 text-sm font-semibold">{key === "firstName" ? "First name" : key === "middleName" ? "Middle name" : "Last name"}<input required={key === "firstName"} value={data[key] ?? ""} onChange={(event) => change(key, event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>)}</div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Birthday<input required type="date" value={data.birthday ?? ""} onChange={(event) => change("birthday", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Gender<select value={data.gender ?? ""} onChange={(event) => change("gender", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label><label className="grid gap-1 text-sm font-semibold">Member type<select value={data.memberTypeId ?? ""} onChange={(event) => change("memberTypeId", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Family role<select value={data.familyRoleId ?? ""} onChange={(event) => change("familyRoleId", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Marital status<select value={data.maritalStatus ?? ""} onChange={(event) => change("maritalStatus", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">{MARITAL_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Status<select value={data.status ?? ""} onChange={(event) => change("status", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="DECEASED">Deceased</option></select></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Email<input type="email" value={data.email ?? ""} onChange={(event) => change("email", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Cellphone<input value={data.cellphone ?? ""} onChange={(event) => change("cellphone", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Wedding date<input type="date" value={data.weddingDate ?? ""} onChange={(event) => change("weddingDate", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Save individual</button>{message && <p role="alert" className="text-sm text-coral">{message}</p>}</form></Container></main>;
}
