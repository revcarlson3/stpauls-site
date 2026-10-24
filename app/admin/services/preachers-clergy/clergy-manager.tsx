"use client";

import { useEffect, useMemo, useState } from "react";
import { CLERGY_TITLES } from "@/lib/services-clergy";

type Member = { id: string; firstName: string; lastName: string | null; email: string | null; cellphone: string | null; otherPhone: string | null; status: string; memberNumber: number };
type Profile = { id: string; title: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; biography: string | null; status: string; photographUrl: string | null; membershipIndividualId: string | null; membershipIndividual: Member | null };

const inputClass = "focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal";

export function ClergyManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<"independent" | "member">("independent");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadProfiles() {
    setLoading(true);
    const response = await fetch(`/api/services/clergy${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    const body = await response.json().catch(() => ({}));
    setProfiles(response.ok ? body.profiles ?? [] : []);
    if (!response.ok) setMessage(body.error ?? "Unable to load clergy.");
    setLoading(false);
  }

  useEffect(() => { void loadProfiles(); }, [query]);
  useEffect(() => {
    if (mode !== "member") return;
    void fetch("/api/services/clergy?members=true").then((response) => response.json()).then((body) => setMembers(body.members ?? [])).catch(() => setMessage("Unable to load membership records."));
  }, [mode]);

  const visibleProfiles = useMemo(() => status === "ALL" ? profiles : profiles.filter((profile) => profile.status === status), [profiles, status]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/services/clergy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), membershipIndividualId: mode === "member" ? form.get("membershipIndividualId") : "" }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to save clergy profile."); return; }
    event.currentTarget.reset();
    setMode("independent");
    setMessage("Clergy profile added.");
    await loadProfiles();
  }

  return <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
    <section className="order-2 xl:order-1">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Clergy and preachers</h2><p className="mt-1 text-sm text-ink/60">Search and filter the people available for services and sermons.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Search clergy" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names or email" className={inputClass} /><select aria-label="Filter clergy status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div></div>
      {loading ? <p className="mt-6 text-sm text-ink/60">Loading clergy...</p> : visibleProfiles.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-ink/20 bg-white/60 p-6 text-sm text-ink/60">No clergy profiles found.</p> : <div className="mt-6 overflow-x-auto rounded-xl border border-ink/10 bg-white"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="border-b border-ink/10 bg-mist/50 text-xs uppercase tracking-wide text-ink/55"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{visibleProfiles.map((profile) => { const member = profile.membershipIndividual; const firstName = member?.firstName ?? profile.firstName; const lastName = member?.lastName ?? profile.lastName; const email = member?.email ?? profile.email; const phone = member?.cellphone ?? member?.otherPhone ?? profile.phone; return <tr key={profile.id} className="border-b border-ink/10 last:border-0"><td className="px-4 py-3"><strong>{profile.title} {firstName} {lastName}</strong>{profile.biography && <span className="mt-1 block max-w-md truncate text-xs text-ink/55">{profile.biography}</span>}</td><td className="px-4 py-3">{email || "—"}</td><td className="px-4 py-3">{phone || "—"}</td><td className="px-4 py-3">{member ? `Membership #${member.memberNumber}` : "Independent"}</td><td className="px-4 py-3">{profile.status === "ACTIVE" ? "Active" : "Inactive"}</td></tr>; })}</tbody></table></div>}
    </section>
    <section className="order-1 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm xl:order-2"><h2 className="font-serif text-2xl">Add preacher or clergy</h2><p className="mt-2 text-sm text-ink/60">Link an existing membership individual when possible, or create an independent clergy record.</p><div className="mt-5 flex gap-2 text-sm"><button type="button" className={`focus-ring rounded-lg border px-3 py-2 ${mode === "independent" ? "border-coral bg-coral/10 text-coral" : "border-ink/15"}`} onClick={() => setMode("independent")}>Independent</button><button type="button" className={`focus-ring rounded-lg border px-3 py-2 ${mode === "member" ? "border-coral bg-coral/10 text-coral" : "border-ink/15"}`} onClick={() => setMode("member")}>From membership</button></div><form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4"><label className="grid gap-1 text-sm font-semibold">Clerical title<select required name="title" defaultValue="" className={inputClass}><option value="">Choose title</option>{CLERGY_TITLES.map((title) => <option key={title} value={title}>{title}</option>)}</select></label>{mode === "member" ? <label className="grid gap-1 text-sm font-semibold">Membership individual<select required name="membershipIndividualId" defaultValue="" className={inputClass}><option value="">Choose member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName ?? ""} · #{member.memberNumber}{member.email ? ` · ${member.email}` : ""}</option>)}</select></label> : <><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">First name<input required name="firstName" className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Last name<input required name="lastName" className={inputClass} /></label></div><label className="grid gap-1 text-sm font-semibold">Email address<input required type="email" name="email" className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Phone<input type="tel" name="phone" className={inputClass} /></label></>}<label className="grid gap-1 text-sm font-semibold">Biography<textarea name="biography" rows={4} maxLength={5000} className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Photograph URL<input type="url" name="photographUrl" placeholder="https://..." className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue="ACTIVE" className={inputClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label><button className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Add clergy profile</button>{message && <p role="alert" className="text-sm text-coral">{message}</p>}</form></section>
  </div>;
}
