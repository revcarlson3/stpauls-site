"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { CLERGY_TITLES } from "@/lib/services-clergy";
import { sanitizeClergyBiographyHtml } from "@/lib/clergy-biography";
import SimpleRichTextEditor from "@/components/simple-rich-text-editor";

type Member = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  cellphone: string | null;
  otherPhone: string | null;
  status: string;
  memberNumber: number;
  family: { photographUrl: string | null };
};

type Profile = {
  id: string;
  title: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  biography: string | null;
  status: string;
  photographUrl: string | null;
  membershipIndividualId: string | null;
  membershipIndividual: Member | null;
};

const inputClass = "focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal";

function profileContact(profile: Profile) {
  const member = profile.membershipIndividual;
  return {
    member,
    firstName: profile.firstName ?? member?.firstName,
    lastName: profile.lastName ?? member?.lastName,
    email: profile.email ?? member?.email,
    phone: profile.phone ?? member?.cellphone ?? member?.otherPhone,
    photoUrl: profile.photographUrl
      ? profile.photographUrl
      : member?.family.photographUrl
        ? `/api/services/clergy/${profile.id}/photo?file=${encodeURIComponent(member.family.photographUrl.split("file=").pop() ?? "")}`
        : null,
  };
}

type DetailsProps = {
  profile: Profile;
  onSave: (event: React.FormEvent<HTMLFormElement>, profile: Profile) => void;
  onInactivate: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
  onCancelEdit: () => void;
  editing: boolean;
  biography: string;
  setBiography: (value: string) => void;
};

function ProfileDetails({ profile, onSave, onInactivate, onEdit, onCancelEdit, editing, biography, setBiography }: DetailsProps) {
  const { member, firstName, lastName, email, phone, photoUrl } = profileContact(profile);
  return <div className="grid gap-6 lg:grid-cols-[10rem_minmax(0,1fr)]">
    <div>{photoUrl ? <img src={photoUrl} alt={`Photograph of ${firstName} ${lastName}`} className="aspect-square w-full rounded-xl object-cover" /> : <div className="aspect-square w-full rounded-xl bg-mist" />}</div>
    <div>
      {editing ? <form onSubmit={(event) => onSave(event, profile)} encType="multipart/form-data" className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Clerical title
          <select required name="title" defaultValue={profile.title} className={inputClass}>{CLERGY_TITLES.map((title) => <option key={title} value={title}>{title}</option>)}</select>
        </label>
        {member && <p className="text-sm text-ink/60">These name and contact values are clergy-specific overrides. Membership is not changed.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">First name<input name="firstName" defaultValue={firstName ?? ""} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Last name<input name="lastName" defaultValue={lastName ?? ""} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Email<input type="email" name="email" defaultValue={email ?? ""} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Phone<input name="phone" defaultValue={phone ?? ""} className={inputClass} /></label>
        </div>
        <SimpleRichTextEditor value={biography} onChange={setBiography} />
        <label className="grid gap-1 text-sm font-semibold">Replace custom photograph<input type="file" name="photo" accept="image/jpeg,image/png" className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Status
          <select name="status" defaultValue={profile.status} className={inputClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Save changes</button>
          <button type="button" onClick={onCancelEdit} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Cancel</button>
        </div>
      </form> : <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-serif text-2xl">{profile.title} {firstName} {lastName}</h3><p className="mt-1 text-sm text-ink/60">{email || "No email"}{phone ? ` · ${phone}` : ""}</p></div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onEdit(profile)} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Edit</button>
            {profile.status === "ACTIVE" && <button type="button" onClick={() => onInactivate(profile)} className="focus-ring rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Delete</button>}
          </div>
        </div>
        <div className="rich-text-content mt-5 leading-7">{profile.biography ? <div dangerouslySetInnerHTML={{ __html: sanitizeClergyBiographyHtml(profile.biography) }} /> : <p className="text-sm text-ink/55">No biography has been added.</p>}</div>
      </>}
    </div>
  </div>;
}

export function ClergyManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<"independent" | "member">("independent");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBiography, setEditBiography] = useState("");
  const [biography, setBiography] = useState("");
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
    const photo = form.get("photo");
    if (!(photo instanceof File) || !photo.size) form.delete("photo");
    form.set("membershipIndividualId", mode === "member" ? String(form.get("membershipIndividualId") ?? "") : "");
    const response = await fetch("/api/services/clergy", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to save clergy profile."); return; }
    event.currentTarget.reset();
    setBiography("");
    setMode("independent");
    setProfiles((current) => [body, ...current.filter((profile: Profile) => profile.id !== body.id)]);
    setExpandedId(body.id);
    setMessage("Clergy profile added.");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, profile: Profile) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("biography", editBiography);
    const response = await fetch(`/api/services/clergy/${profile.id}`, { method: "PATCH", body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to update clergy profile."); return; }
    setEditingId(null);
    setMessage("Clergy profile updated.");
    await loadProfiles();
  }

  async function inactivate(profile: Profile) {
    if (!window.confirm("Inactivate this clergy profile?")) return;
    const response = await fetch(`/api/services/clergy/${profile.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to inactivate clergy profile."); return; }
    setExpandedId(null);
    setMessage("Clergy profile inactivated.");
    await loadProfiles();
  }

  return <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
    <section className="order-2 xl:order-1">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Clergy and preachers</h2><p className="mt-1 text-sm text-ink/60">Select a person to view details or manage their profile.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Search clergy" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names or email" className={inputClass} /><select aria-label="Filter clergy status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div></div>
      {loading ? <p className="mt-6 text-sm text-ink/60">Loading clergy...</p> : visibleProfiles.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-ink/20 bg-white/60 p-6 text-sm text-ink/60">No clergy profiles found.</p> : <div className="mt-6 overflow-x-auto rounded-xl border border-ink/10 bg-white"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="border-b border-ink/10 bg-mist/50 text-xs uppercase tracking-wide text-ink/55"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{visibleProfiles.map((profile) => {
        const { member, firstName, lastName, email, phone } = profileContact(profile);
        const expanded = expandedId === profile.id;
        return <Fragment key={profile.id}><tr className="cursor-pointer border-b border-ink/10 hover:bg-mist/30" onClick={() => { setExpandedId(expanded ? null : profile.id); setEditingId(null); }}><td className="px-4 py-3"><strong>{profile.title} {firstName} {lastName}</strong></td><td className="px-4 py-3">{email || "—"}</td><td className="px-4 py-3">{phone || "—"}</td><td className="px-4 py-3">{member ? `Membership #${member.memberNumber}` : "Independent"}</td><td className="px-4 py-3">{profile.status === "ACTIVE" ? "Active" : "Inactive"}</td></tr>{expanded && <tr><td colSpan={5} className="border-b border-ink/10 bg-mist/20 p-5"><ProfileDetails profile={profile} editing={editingId === profile.id} biography={editBiography} setBiography={setEditBiography} onSave={saveEdit} onEdit={(selected) => { setExpandedId(selected.id); setEditingId(selected.id); setEditBiography(selected.biography ?? ""); }} onCancelEdit={() => setEditingId(null)} onInactivate={inactivate} /></td></tr>}</Fragment>;
      })}</tbody></table></div>}
      {message && <p role="alert" className="mt-3 text-sm text-coral">{message}</p>}
    </section>
    <section className="order-1 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm xl:order-2"><h2 className="font-serif text-2xl">Add preacher or clergy</h2><p className="mt-2 text-sm text-ink/60">Link an existing membership individual when possible, or create an independent clergy record.</p><div className="mt-5 flex gap-2 text-sm"><button type="button" className={`focus-ring rounded-lg border px-3 py-2 ${mode === "independent" ? "border-coral bg-coral/10 text-coral" : "border-ink/15"}`} onClick={() => setMode("independent")}>Independent</button><button type="button" className={`focus-ring rounded-lg border px-3 py-2 ${mode === "member" ? "border-coral bg-coral/10 text-coral" : "border-ink/15"}`} onClick={() => setMode("member")}>From membership</button></div><form onSubmit={(event) => void submit(event)} encType="multipart/form-data" className="mt-5 grid gap-4"><label className="grid gap-1 text-sm font-semibold">Clerical title<select required name="title" defaultValue="" className={inputClass}><option value="">Choose title</option>{CLERGY_TITLES.map((title) => <option key={title} value={title}>{title}</option>)}</select></label>{mode === "member" ? <label className="grid gap-1 text-sm font-semibold">Membership individual<select required name="membershipIndividualId" defaultValue="" className={inputClass}><option value="">Choose member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName ?? ""} · #{member.memberNumber}{member.email ? ` · ${member.email}` : ""}</option>)}</select></label> : <><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">First name<input required name="firstName" className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Last name<input required name="lastName" className={inputClass} /></label></div><label className="grid gap-1 text-sm font-semibold">Email address<input required type="email" name="email" className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Phone<input type="tel" name="phone" className={inputClass} /></label></>}<SimpleRichTextEditor value={biography} onChange={setBiography} /><input type="hidden" name="biography" value={biography} /><label className="grid gap-1 text-sm font-semibold">Custom photograph<input type="file" name="photo" accept="image/jpeg,image/png" className={inputClass} /><span className="text-xs font-normal text-ink/55">JPG or PNG, 100–4000 px per side, maximum 5 MB. Custom photos override a linked membership photo.</span></label><label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue="ACTIVE" className={inputClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label><button className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Add clergy profile</button></form></section>
  </div>;
}
