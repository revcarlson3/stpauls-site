"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Card, Container } from "@/components/ui";
import { US_STATES } from "@/lib/us-states";

type CustomValue = { definitionId: string; value: string };
type Profile = {
  linked: boolean;
  pendingRequest?: { id: string; createdAt: string } | null;
  individual?: Record<string, string | null> & {
    customValues: CustomValue[];
    family: Record<string, string | null> & { customValues: CustomValue[] };
  };
  fields?: { fieldKey: string; label: string; type: string | null }[];
  canEditFamily?: boolean;
};

export default function MembershipProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/membership");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to load your membership profile.");
      setProfile(body);
    } catch (loadError) {
      setProfile(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load your membership profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, []);

  if (loading) return <main className="py-16"><Container><p role="status">Loading membership profile...</p></Container></main>;
  if (error) return <main className="py-16"><Container><Card><h1 className="font-serif text-3xl">Membership profile unavailable</h1><p role="alert" className="mt-3 text-sm text-ink/60">{error}</p><button type="button" onClick={() => void loadProfile()} className="focus-ring mt-5 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Try again</button></Card></Container></main>;
  if (!profile) return null;
  if (!profile.linked) return <main className="py-16"><Container><Card><h1 className="font-serif text-3xl">Membership access</h1>{profile.pendingRequest ? <p className="mt-3 text-sm text-ink/60">Your membership link request is awaiting review by a church administrator. We will notify you when it has been processed.</p> : <p className="mt-3 text-sm text-ink/60">Your account is not linked to a membership record yet. Request access from your Account page so an administrator can review the link.</p>}<a href="/account" className="focus-ring mt-5 inline-block rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral">Go to Account</a></Card></Container></main>;

  const current = profile;
  const fields = current.fields ?? [];
  const canEditPhoto = current.canEditFamily && fields.some((field) => field.fieldKey === "familyPhotographUrl");
  const familyPhotoUrl = current.individual?.family.photographUrl || "/no-family-photo.jpg";
  const hasFamilyPhoto = Boolean(current.individual?.family.photographUrl);

  function valueFor(key: string) {
    if (key === "familyPhone") return current.individual?.family.phone ?? "";
    if (key === "familyEmail") return current.individual?.family.email ?? "";
    if (key.startsWith("customField:")) {
      const definitionId = key.slice("customField:".length);
      return current.individual?.customValues.find((entry) => entry.definitionId === definitionId)?.value
        ?? current.individual?.family.customValues.find((entry) => entry.definitionId === definitionId)?.value
        ?? "";
    }
    return (current.individual?.[key] as string | null) ?? current.individual?.family[key] ?? "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/account/membership", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Your membership information was updated." : body.error ?? "Unable to update your information.");
    setBusy(false);
    if (response.ok) await loadProfile();
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    setMessage("");
    const formData = new FormData();
    formData.set("photo", file);
    const response = await fetch("/api/account/membership", { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Family photograph uploaded." : body.error ?? "Unable to upload photograph.");
    setBusy(false);
    if (response.ok) await loadProfile();
  }

  async function removePhoto() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/account/membership", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Family photograph removed." : body.error ?? "Unable to remove photograph.");
    setBusy(false);
    if (response.ok) await loadProfile();
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadPhoto(file);
  }

  const profilePhoto = <img src={familyPhotoUrl} alt={`Photograph of the ${current.individual?.family.lastName ?? "family"}`} className="h-full w-full object-cover" />;
  const editableFields = fields.filter((field) => field.fieldKey !== "familyPhotographUrl" && (current.canEditFamily || !field.fieldKey.startsWith("address") && !field.fieldKey.startsWith("secondary") && !field.fieldKey.startsWith("family") && field.fieldKey !== "familyPhone" && field.fieldKey !== "familyEmail"));
  const profileName = [current.individual?.firstName, current.individual?.middleName, current.individual?.lastName].filter(Boolean).join(" ");
  const calledByName = current.individual?.calledByName?.trim();

  return <main className="py-16"><Container className="max-w-3xl"><Card>
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {canEditPhoto ? <div className="flex w-40 shrink-0 flex-col items-center gap-2">
        <button type="button" disabled={busy} className="focus-ring group relative h-40 w-40 overflow-hidden rounded-2xl bg-mist shadow-sm disabled:cursor-wait disabled:opacity-70" onClick={() => photoInputRef.current?.click()} aria-label="Upload a new family photograph">
          {profilePhoto}<span className="absolute inset-x-0 bottom-0 bg-ink/75 px-3 py-2 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">Change photo</span>
        </button>
        <input ref={photoInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
        {hasFamilyPhoto && <button type="button" disabled={busy} onClick={() => void removePhoto()} className="focus-ring text-xs font-semibold text-ink/55 underline hover:text-coral disabled:opacity-50">Remove photo</button>}
      </div> : <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-mist shadow-sm">{profilePhoto}</div>}
      <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">My membership</p><h1 className="mt-2 font-serif text-4xl">{profileName}{calledByName && <span className="ml-2 text-2xl text-ink/60">({calledByName})</span>}</h1><p className="mt-2 text-sm text-ink/60">Update only the fields enabled by your church administrator. Member records cannot be deleted here.</p></div>
    </div>
    <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
      {editableFields.map((field) => <label key={field.fieldKey} className="grid gap-1 text-sm font-semibold">{field.label}
        {field.fieldKey === "addressState" ? <select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={values[field.fieldKey] ?? valueFor(field.fieldKey)} onChange={(event) => setValues((current) => ({ ...current, [field.fieldKey]: event.target.value }))}><option value="">Select a state</option>{US_STATES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select> : <input type={field.type === "DATE" || field.fieldKey === "weddingDate" || field.fieldKey === "deceasedDate" ? "date" : "text"} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={values[field.fieldKey] ?? valueFor(field.fieldKey)} onChange={(event) => setValues((current) => ({ ...current, [field.fieldKey]: event.target.value }))} />}
      </label>)}
      {message && <p className="sm:col-span-2 text-sm font-semibold">{message}</p>}
      <button disabled={busy} className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2">{busy ? "Saving..." : "Save membership information"}</button>
    </form>
  </Card></Container></main>;
}
