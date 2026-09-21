"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container } from "@/components/ui";
import { MARITAL_STATUSES } from "@/lib/modules";
import CustomFieldsInput, { CustomFieldValueMap } from "@/app/admin/membership/custom-fields-input";
import { GRADE_LEVELS, OTHER_PHONE_TYPES } from "@/lib/membership-options";
import { PREFERRED_CONTACT_METHOD_OPTIONS } from "@/lib/membership-contact-preferences";

export default function EditIndividualPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, string>>({});
  const [emailMessagesAllowed, setEmailMessagesAllowed] = useState(false);
  const [smsMessagesAllowed, setSmsMessagesAllowed] = useState(false);
  const [doNotContact, setDoNotContact] = useState(false);
  const [directoryListed, setDirectoryListed] = useState(true);
  const [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [ageCategories, setAgeCategories] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValueMap>({});
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveData, setMoveData] = useState({ lastName: "", phone: "", email: "", addressStreet: "", addressCity: "", addressState: "", addressZip: "" });

  useEffect(() => {
    void Promise.all([
      fetch(`/api/membership?id=${params.id}`),
      fetch("/api/membership/individuals"),
      fetch("/api/membership/reference")
    ]).then(async ([memberResponse, familyResponse, referenceResponse]) => {
      const member = (await memberResponse.json()).selected;
      const familyData = await familyResponse.json();
      const referenceData = await referenceResponse.json();
      setData({
        ...member,
        lastName: member.lastName ?? member.family.lastName,
        familyId: member.family.id,
        memberTypeId: member.memberType.id,
        familyRoleId: member.familyRole.id,
        envelopeNumber: member.envelopeNumber ?? "",
        birthday: member.birthday.slice(0, 10),
        weddingDate: member.weddingDate?.slice(0, 10) ?? "",
        deceasedDate: member.deceasedDate?.slice(0, 10) ?? "",
        preferredContactMethod: member.preferredContactMethod ?? "NO_PREFERENCE",
        communicationNotes: member.communicationNotes ?? "",
        relationshipNotes: member.relationshipNotes ?? ""
      });
      setEmailMessagesAllowed(member.emailMessagesAllowed === true);
      setSmsMessagesAllowed(member.smsMessagesAllowed === true);
      setDoNotContact(member.doNotContact === true);
      setDirectoryListed(member.directoryListed !== false);
      setCustomFieldValues(Object.fromEntries((member.customValues ?? []).map((entry: { definitionId: string; value: string }) => [entry.definitionId, entry.value])));
      setFamilies(familyData.families ?? []);
      setRoles(referenceData.roles ?? []);
      setTypes(referenceData.types ?? []);
      setAgeCategories(referenceData.ageCategories ?? []);
    }).catch(() => setMessage("Unable to load individual."));
  }, [params.id]);

  function change(key: string, value: string) {
    setData((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/membership/individuals/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, directoryListed, emailMessagesAllowed, smsMessagesAllowed, doNotContact, customFieldValues })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to save individual.");
      return;
    }

    router.push("/admin/membership");
  }

  async function moveToNewFamily(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/membership/individuals/${params.id}/move-to-new-family`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(moveData) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to move individual.");
      return;
    }
    router.push(`/admin/membership/families/${body.familyId}/edit`);
  }

  const inputClass = "focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal";

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
        <h1 className="mt-2 font-serif text-4xl">Edit individual</h1>
        <form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-2xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold">Family
            <select value={data.familyId ?? ""} onChange={(event) => change("familyId", event.target.value)} className={inputClass}>
              {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {["firstName", "middleName"].map((key) => (
              <label key={key} className="grid gap-1 text-sm font-semibold">
                {key === "firstName" ? "First name" : key === "middleName" ? "Middle name" : "Last name"}
                <input required={key === "firstName"} value={data[key] ?? ""} onChange={(event) => change(key, event.target.value)} className={inputClass} />
              </label>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold">Last name<input required value={data.lastName ?? ""} onChange={(event) => change("lastName", event.target.value)} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Called by name<input value={data.calledByName ?? ""} onChange={(event) => change("calledByName", event.target.value)} className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Birthday<input required type="date" value={data.birthday ?? ""} onChange={(event) => change("birthday", event.target.value)} className={inputClass} /></label>
            <label className="grid gap-1 text-sm font-semibold">Gender<select value={data.gender ?? ""} onChange={(event) => change("gender", event.target.value)} className={inputClass}><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Member type<select value={data.memberTypeId ?? ""} onChange={(event) => change("memberTypeId", event.target.value)} className={inputClass}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Family role<select value={data.familyRoleId ?? ""} onChange={(event) => change("familyRoleId", event.target.value)} className={inputClass}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Marital status<select value={data.maritalStatus ?? ""} onChange={(event) => change("maritalStatus", event.target.value)} className={inputClass}>{MARITAL_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Status<select value={data.status ?? ""} onChange={(event) => change("status", event.target.value)} className={inputClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="DECEASED">Deceased</option></select></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Relationship details
            <textarea value={data.relationshipNotes ?? ""} onChange={(event) => change("relationshipNotes", event.target.value)} maxLength={500} rows={2} placeholder="Optional clarification, such as guardian, stepchild, or unrelated household member" className={`${inputClass} resize-y`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Member / envelope number<input value={data.envelopeNumber ?? ""} onChange={(event) => change("envelopeNumber", event.target.value)} className={inputClass} /></label>
            <label className="grid gap-1 text-sm font-semibold">Email<input type="email" value={data.email ?? ""} onChange={(event) => change("email", event.target.value)} className={inputClass} /></label>
            <label className="grid gap-1 text-sm font-semibold">Cellphone<input value={data.cellphone ?? ""} onChange={(event) => change("cellphone", event.target.value)} className={inputClass} /></label>
            <label className="grid gap-1 text-sm font-semibold">Other phone<input value={data.otherPhone ?? ""} onChange={(event) => change("otherPhone", event.target.value)} className={inputClass} /></label>
            <label className="grid gap-1 text-sm font-semibold">Other phone type<select value={data.otherPhoneType ?? ""} onChange={(event) => change("otherPhoneType", event.target.value)} className={inputClass}><option value="">Choose type</option>{OTHER_PHONE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Grade level<select value={data.gradeLevel ?? ""} onChange={(event) => change("gradeLevel", event.target.value)} className={inputClass}><option value="">Choose grade level</option>{GRADE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Age category override<select value={data.ageCategoryOverride ?? ""} onChange={(event) => change("ageCategoryOverride", event.target.value)} className={inputClass}><option value="">Calculated from birthday</option>{ageCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Wedding date<input type="date" value={data.weddingDate ?? ""} onChange={(event) => change("weddingDate", event.target.value)} className={inputClass} /></label>
            <label className="grid gap-1 text-sm font-semibold">Deceased date<input type="date" value={data.deceasedDate ?? ""} onChange={(event) => change("deceasedDate", event.target.value)} className={inputClass} /></label>
          </div>
          <fieldset className="grid gap-2 rounded-xl border border-ink/10 p-4">
            <legend className="px-1 text-sm font-semibold">Directory privacy</legend>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={directoryListed} onChange={(event) => setDirectoryListed(event.target.checked)} className="mt-0.5" /><span><span className="font-semibold">List this individual in member-facing directories</span><span className="mt-1 block text-xs text-ink/55">The family must also be listed. Membership managers can always access this record.</span></span></label>
          </fieldset>
          <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4">
            <legend className="px-1 text-sm font-semibold">Contact and messaging preferences</legend>
            <p className="text-xs text-ink/55">Channel opt-ins determine message eligibility. Do not contact overrides every direct or audience-based membership message.</p>
            <label className="grid gap-1 text-sm font-semibold">Preferred contact method
              <select value={data.preferredContactMethod ?? "NO_PREFERENCE"} onChange={(event) => change("preferredContactMethod", event.target.value)} className={inputClass}>
                {PREFERRED_CONTACT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={emailMessagesAllowed} onChange={(event) => setEmailMessagesAllowed(event.target.checked)} /> Allow email messages</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smsMessagesAllowed} onChange={(event) => setSmsMessagesAllowed(event.target.checked)} /> Allow SMS messages</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-coral"><input type="checkbox" checked={doNotContact} onChange={(event) => setDoNotContact(event.target.checked)} /> Do not contact through membership messaging</label>
            <label className="grid gap-1 text-sm font-semibold">Communication notes
              <textarea value={data.communicationNotes ?? ""} onChange={(event) => change("communicationNotes", event.target.value)} maxLength={1000} rows={3} placeholder="Best times to call, accessibility needs, or other communication guidance" className={`${inputClass} resize-y`} />
            </label>
          </fieldset>
          <CustomFieldsInput appliesTo="INDIVIDUAL" values={customFieldValues} onChange={setCustomFieldValues} />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Save individual</button>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setMoveData((current) => ({ ...current, lastName: data.lastName ?? "" })); setMoveOpen(true); }} className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Move to new family</button><button type="button" onClick={() => router.back()} className="focus-ring rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink/70">Cancel</button></div>
          </div>
          {message && <p role="alert" className="text-sm text-coral">{message}</p>}
        </form>
        {moveOpen && <div role="dialog" aria-modal="true" aria-labelledby="move-family-heading" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-5"><form onSubmit={(event) => void moveToNewFamily(event)} className="grid w-full max-w-xl gap-4 rounded-2xl bg-white p-6 shadow-xl"><div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Household transition</p><h2 id="move-family-heading" className="mt-1 font-serif text-2xl">Move to a new family</h2><p className="mt-2 text-sm text-ink/60">This creates a new family, moves this individual into it as Head of Household, and leaves the current family unchanged apart from removing this member.</p></div><div className="grid gap-4 sm:grid-cols-2">{[["lastName", "Family last name"], ["phone", "Family phone"], ["email", "Family email"], ["addressStreet", "Street"], ["addressCity", "City"], ["addressState", "State"], ["addressZip", "ZIP"]].map(([key, label]) => <label key={key} className="grid gap-1 text-sm font-semibold">{label}<input required={key === "lastName"} value={moveData[key as keyof typeof moveData]} onChange={(event) => setMoveData((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} /></label>)}</div><div className="flex justify-end gap-3"><button type="button" onClick={() => setMoveOpen(false)} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Cancel</button><button className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Create and move</button></div></form></div>}
      </Container>
    </main>
  );
}
