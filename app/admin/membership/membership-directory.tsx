"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Member = {
  id: string; firstName: string; middleName: string | null; lastName: string | null; birthday: string;
  ageCategoryOverride: string | null; cellphone: string | null; otherPhone: string | null; otherPhoneType: string | null;
  email: string | null; memberNumber: number; gradeLevel: string | null; maritalStatus: string; weddingDate: string | null;
  deceasedDate: string | null; gender: string; status: string; familyRole: { name: string };
  memberType: { name: string }; family: Record<string, string | boolean | null>;
};
type Row = { id: string; firstName: string; middleName: string | null; lastName: string | null; familyLastName: string; memberNumber: number; memberType: string; status: string };

export function MembershipDirectory() {
  const [members, setMembers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [types, setTypes] = useState<{ slug: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [memberType, setMemberType] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ ...(search ? { search } : {}), ...(memberType ? { memberType } : {}) });
    void fetch(`/api/membership?${params}`).then((response) => response.ok ? response.json() : null).then((value) => {
      if (value) { setMembers(value.members); setTypes(value.types); setSelected(value.selected); }
    }).catch(() => undefined);
  }, [search, memberType]);

  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <h2 className="font-serif text-2xl">Members</h2>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Search by name<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="First or last name" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Member type<select value={memberType} onChange={(event) => setMemberType(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">All types</option>{types.map((type) => <option key={type.slug} value={type.slug}>{type.name}</option>)}</select></label>
      </div>
      <div className="mt-5 grid gap-1" aria-live="polite">{members.map((member) => <button type="button" key={member.id} onClick={() => void fetch(`/api/membership?id=${member.id}`).then((response) => response.json()).then((value) => setSelected(value.selected))} className={`focus-ring rounded-lg p-3 text-left hover:bg-mist ${selected?.id === member.id ? "bg-mist" : ""}`}><span className="block font-semibold">{member.firstName} {member.middleName ?? ""} {member.lastName ?? member.familyLastName}</span><span className="text-xs text-ink/55">#{member.memberNumber} · {member.memberType} · {member.status.toLowerCase()}</span></button>)}</div>
      {!members.length && <p className="mt-5 text-sm text-ink/60">No members match these filters.</p>}
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Member details</h2>
      {selected ? <div className="mt-5 grid gap-6">
        <div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Individual</p><h3 className="mt-1 font-serif text-3xl">{selected.firstName} {selected.middleName} {selected.lastName ?? selected.family.lastName}</h3><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[["Member number", selected.memberNumber], ["Member type", selected.memberType.name], ["Family role", selected.familyRole.name], ["Status", selected.status], ["Birthday", new Date(selected.birthday).toLocaleDateString()], ["Age category", selected.ageCategoryOverride ?? "Calculated"], ["Gender", selected.gender], ["Marital status", selected.maritalStatus], ["Grade level", selected.gradeLevel], ["Cellphone", selected.cellphone], ["Other phone", `${selected.otherPhone ?? ""} ${selected.otherPhoneType ? `(${selected.otherPhoneType})` : ""}`], ["Email", selected.email], ["Wedding date", selected.weddingDate ? new Date(selected.weddingDate).toLocaleDateString() : "—"], ["Deceased date", selected.deceasedDate ? new Date(selected.deceasedDate).toLocaleDateString() : "—"]].map(([label, value]) => <div key={String(label)}><dt className="font-semibold text-ink/60">{label}</dt><dd>{value || "—"}</dd></div>)}</dl></div>
        <div className="border-t border-ink/10 pt-5"><p className="text-sm font-semibold uppercase tracking-wider text-coral">Family</p><div className="mt-3 grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">{typeof selected.family.photographUrl === "string" && selected.family.photographUrl ? <button type="button" className="focus-ring block aspect-[4/5] overflow-hidden rounded-xl bg-mist" onClick={() => setLightboxOpen(true)} aria-label="Open family photograph"><Image src={selected.family.photographUrl} alt={`Photograph of the ${selected.family.lastName} family`} width={320} height={400} className="h-full w-full object-cover" /></button> : <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-mist text-center text-xs text-ink/50">No family<br />photograph</div>}<div><h3 className="font-serif text-2xl">{selected.family.familyNameOverride || selected.family.lastName}</h3><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[["Formal greeting", selected.family.formalGreeting], ["Informal greeting", selected.family.informalGreeting], ["Address", [selected.family.addressStreet, selected.family.addressCity, selected.family.addressState, selected.family.addressZip].filter(Boolean).join(", ")], ["Secondary address", [selected.family.secondaryStreet, selected.family.secondaryCity, selected.family.secondaryState, selected.family.secondaryZip].filter(Boolean).join(", ")], ["Phone", selected.family.phone], ["Phone type", selected.family.phoneIsMobile ? "Cellphone" : "Land line"], ["Email", selected.family.email], ["Status", selected.family.status]].map(([label, value]) => <div key={String(label)}><dt className="font-semibold text-ink/60">{label}</dt><dd>{value || "—"}</dd></div>)}</dl></div></div></div>
      </div> : <p className="mt-4 text-sm text-ink/60">Select a member to view details.</p>}
    </section>
    {lightboxOpen && selected && typeof selected.family.photographUrl === "string" && <div role="dialog" aria-modal="true" aria-label="Family photograph" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5" onClick={() => setLightboxOpen(false)}><div className="relative max-h-full max-w-lg" onClick={(event) => event.stopPropagation()}><Image src={selected.family.photographUrl} alt={`Photograph of the ${selected.family.lastName} family`} width={800} height={1000} className="max-h-[85vh] w-auto rounded-xl object-contain" /><button type="button" className="focus-ring absolute -right-3 -top-3 rounded-full bg-white px-3 py-1 text-xl text-ink shadow" onClick={() => setLightboxOpen(false)} aria-label="Close family photograph">×</button></div></div>}
  </div>;
}
