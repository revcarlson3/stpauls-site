"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CustomFieldsInput, { CustomFieldValueMap } from "@/app/admin/membership/custom-fields-input";
import { Container } from "@/components/ui";
import { US_STATES } from "@/lib/us-states";
import { MembershipTimeline } from "@/app/admin/membership/membership-timeline";

type Family = {
  lastName: string;
  phone: string | null;
  email: string | null;
  directoryListed: boolean;
  status: "ACTIVE" | "INACTIVE";
  formalGreeting: string | null;
  informalGreeting: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  photographUrl: string | null;
  individuals: Array<{
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string | null;
    status: string;
    relationshipNotes: string | null;
    familyRole: { name: string; slug: string };
  }>;
};

type FamilyDocument = {
  id: string;
  originalName: string;
  category: string;
  description: string | null;
  memberVisible: boolean;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
  createdAt: string;
  downloadUrl: string;
};

const fields: { key: Exclude<keyof Family, "directoryListed" | "individuals">; label: string; type?: string }[] = [
  { key: "lastName", label: "Family last name" },
  { key: "phone", label: "Family phone", type: "tel" },
  { key: "email", label: "Family email", type: "email" },
  { key: "formalGreeting", label: "Formal greeting" },
  { key: "informalGreeting", label: "Informal greeting" },
  { key: "addressStreet", label: "Street" },
  { key: "addressCity", label: "City" },
  { key: "addressZip", label: "ZIP + 4" }
];

function fileSizeLabel(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EditFamilyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [documents, setDocuments] = useState<FamilyDocument[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentCategory, setDocumentCategory] = useState("OTHER");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentMemberVisible, setDocumentMemberVisible] = useState(true);
  const [documentInputKey, setDocumentInputKey] = useState(0);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValueMap>({});

  useEffect(() => {
    void Promise.all([
      fetch(`/api/membership/families/${params.id}`),
      fetch(`/api/membership/families/${params.id}/documents`)
    ])
      .then(async ([familyResponse, documentsResponse]) => {
        const familyBody = await familyResponse.json();
        const documentsBody = await documentsResponse.json();
        if (!familyResponse.ok) throw new Error(familyBody.error ?? "Unable to load family.");
        if (!documentsResponse.ok) throw new Error(documentsBody.error ?? "Unable to load family documents.");
        setFamily(familyBody.family);
        setDocuments(documentsBody.documents);
        setCustomFieldValues(Object.fromEntries((familyBody.family.customValues ?? []).map((entry: { definitionId: string; value: string }) => [entry.definitionId, entry.value])));
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.id]);

  function change(key: keyof Family, value: string | boolean | null) {
    setFamily((current) => current ? { ...current, [key]: value } : current);
  }

  async function uploadPhoto() {
    if (!photo) return;
    const formData = new FormData();
    formData.set("photo", photo);
    const response = await fetch(`/api/membership/families/${params.id}`, { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to upload family photograph.");
      return;
    }
    setFamily((current) => current ? { ...current, ...body.family, individuals: current.individuals } : body.family);
    setPhoto(null);
    setMessage("Family photograph uploaded.");
  }

  async function removePhoto() {
    const response = await fetch(`/api/membership/families/${params.id}?photo=1`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Unable to remove family photograph.");
      return;
    }
    setFamily((current) => current ? { ...current, photographUrl: null } : current);
    setMessage("Family photograph removed.");
  }

  async function uploadDocument() {
    if (!documentFile) return;
    setUploadingDocument(true);
    setMessage("");
    const formData = new FormData();
    formData.set("document", documentFile);
    formData.set("category", documentCategory);
    formData.set("description", documentDescription);
    formData.set("memberVisible", String(documentMemberVisible));
    try {
      const response = await fetch(`/api/membership/families/${params.id}/documents`, { method: "POST", body: formData });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to upload family document.");
      setDocuments((current) => [body.document, ...current]);
      setDocumentFile(null);
      setDocumentCategory("OTHER");
      setDocumentDescription("");
      setDocumentMemberVisible(true);
      setDocumentInputKey((current) => current + 1);
      setMessage("Family document uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload family document.");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function deleteDocument(document: FamilyDocument) {
    if (!window.confirm(`Delete “${document.originalName}”? This cannot be undone.`)) return;
    setDeletingDocumentId(document.id);
    setMessage("");
    try {
      const response = await fetch(`/api/membership/families/${params.id}/documents/${document.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to delete family document.");
      setDocuments((current) => current.filter((entry) => entry.id !== document.id));
      setMessage("Family document deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete family document.");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function saveDocumentExpiry(document: FamilyDocument, expiresAt = document.expiresAt) {
    setSavingDocumentId(document.id);
    setMessage("");
    try {
      const response = await fetch(`/api/membership/families/${params.id}/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt: expiresAt ? expiresAt.slice(0, 10) : null })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to update document retention.");
      setDocuments((current) => current.map((entry) => entry.id === document.id ? body.document : entry));
      setMessage(expiresAt ? "Document expiry saved." : "Document expiry cleared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update document retention.");
    } finally {
      setSavingDocumentId(null);
    }
  }

  async function saveDocumentMetadata(document: FamilyDocument) {
      setSavingDocumentId(document.id);
      try {
        const response = await fetch(`/api/membership/families/${params.id}/documents/${document.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresAt: document.expiresAt ? document.expiresAt.slice(0, 10) : null, category: document.category, description: document.description, memberVisible: document.memberVisible })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to update document metadata.");
        setDocuments((current) => current.map((entry) => entry.id === document.id ? body.document : entry));
        setMessage("Document metadata saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update document metadata.");
      } finally {
        setSavingDocumentId(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family) return;
    const response = await fetch(`/api/membership/families/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...family, customFieldValues })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to save family.");
      return;
    }
    router.push("/admin/membership");
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
        <h1 className="mt-2 font-serif text-4xl">Edit family</h1>
        {family ? (
          <form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-3xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            {fields.map(({ key, label, type }) => (
              <label key={key} className="grid gap-1 text-sm font-semibold">
                {label}
                <input required={key === "lastName" || key === "phone" || key === "email"} type={type ?? "text"} value={family[key] ?? ""} onChange={(event) => change(key, event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-semibold">
              State
              <select value={family.addressState ?? ""} onChange={(event) => change("addressState", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">
                <option value="">Choose a state</option>
                {US_STATES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
            </label>
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm font-semibold">
                Family photograph
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" />
              </label>
              <div className="flex flex-wrap gap-2">
                {photo && <button type="button" onClick={() => void uploadPhoto()} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Upload photograph</button>}
                {family.photographUrl && <button type="button" onClick={() => void removePhoto()} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold text-ink/70">Remove photograph</button>}
              </div>
              <p className="text-xs text-ink/55">JPG, PNG, or WebP up to 5 MB. Files are stored with a randomized filename.</p>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
              Family status
              <select value={family.status} onChange={(event) => change("status", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <fieldset className="grid gap-2 rounded-xl border border-ink/10 p-4">
              <legend className="px-1 text-sm font-semibold">Directory privacy</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={family.directoryListed} onChange={(event) => change("directoryListed", event.target.checked)} className="mt-0.5" />
                <span><span className="font-semibold">List this family in member-facing directories</span><span className="mt-1 block text-xs text-ink/55">Turning this off hides the household and all its members from directory listings. Membership managers can still access the records.</span></span>
              </label>
            </fieldset>
            <section className="rounded-xl border border-ink/10 p-4" aria-labelledby="household-members-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 id="household-members-heading" className="font-serif text-xl">Household relationships</h2>
                  <p className="mt-1 text-xs text-ink/55">An active family must have exactly one Head of Household.</p>
                </div>
                <a href="/admin/membership/individuals/add" className="text-sm font-semibold text-coral">Add individual</a>
              </div>
              <div className="mt-3 grid gap-2">
                {family.individuals.map((individual) => (
                  <a key={individual.id} href={`/admin/membership/individuals/${individual.id}/edit`} className="focus-ring rounded-lg border border-ink/10 px-3 py-2 text-sm hover:bg-mist">
                    <span className="font-semibold">{individual.firstName} {individual.middleName ? `${individual.middleName.charAt(0)}. ` : ""}{individual.lastName ?? family.lastName}</span>
                    <span className="block text-xs text-ink/60">{individual.familyRole.name} · {individual.status.toLowerCase()}</span>
                    {individual.relationshipNotes && <span className="mt-1 block text-xs text-ink/70">{individual.relationshipNotes}</span>}
                  </a>
                ))}
                {!family.individuals.length && <p className="text-sm text-coral">No active household members. Add a Head of Household before keeping this family active.</p>}
              </div>
            </section>
            <CustomFieldsInput appliesTo="FAMILY" values={customFieldValues} onChange={setCustomFieldValues} />

            <section className="mt-3 border-t border-ink/10 pt-5" aria-labelledby="family-documents-heading">
              <h2 id="family-documents-heading" className="font-serif text-2xl">Documents</h2>
              <p className="mt-1 text-sm text-ink/60">Upload PDF, JPG, PNG, or WebP files up to 10 MB. Documents require membership access to download.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Category<select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="OTHER">Other</option><option value="POLICY">Policy</option><option value="DIRECTORY">Directory</option><option value="FORM">Form</option><option value="LETTER">Letter</option><option value="PHOTO">Photo</option></select></label>
                <label className="grid gap-1 text-sm font-semibold">Description<input value={documentDescription} maxLength={500} onChange={(event) => setDocumentDescription(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
                <label className="grid flex-1 gap-1 text-sm font-semibold">
                  Choose document
                  <input key={documentInputKey} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={documentMemberVisible} onChange={(event) => setDocumentMemberVisible(event.target.checked)} /> Visible to linked members</label>
                <button type="button" disabled={!documentFile || uploadingDocument} onClick={() => void uploadDocument()} className="focus-ring w-fit rounded-full bg-coral px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {uploadingDocument ? "Uploading..." : "Upload document"}
                </button>
              </div>
              <div className="mt-5 grid gap-2" aria-live="polite">
                {documents.length ? documents.map((document) => (
                  <div key={document.id} className="grid gap-3 rounded-xl border border-ink/10 bg-mist/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{document.originalName}</p>
                      <p className="text-xs text-ink/55">{document.category} · {fileSizeLabel(document.sizeBytes)} · Uploaded {new Date(document.createdAt).toLocaleDateString()}</p>
                      {document.description && <p className="mt-1 text-xs text-ink/65">{document.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={document.downloadUrl} className="focus-ring rounded-full border border-coral px-3 py-1.5 text-xs font-semibold text-coral">Download</a>
                        <button type="button" disabled={deletingDocumentId === document.id} onClick={() => void deleteDocument(document)} className="focus-ring rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50">
                          {deletingDocumentId === document.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
                      <label className="grid gap-1 text-xs font-semibold">
                        Retain through
                        <input
                          type="date"
                          value={document.expiresAt?.slice(0, 10) ?? ""}
                          onChange={(event) => setDocuments((current) => current.map((entry) => entry.id === document.id ? { ...entry, expiresAt: event.target.value || null } : entry))}
                          className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-1.5 font-normal"
                        />
                      </label>
                      <button type="button" disabled={savingDocumentId === document.id} onClick={() => void saveDocumentExpiry(document)} className="focus-ring rounded-full border border-coral px-3 py-1.5 text-xs font-semibold text-coral disabled:opacity-50">
                        {savingDocumentId === document.id ? "Saving..." : "Save expiry"}
                      </button>
                      {document.expiresAt && <button type="button" disabled={savingDocumentId === document.id} onClick={() => void saveDocumentExpiry(document, null)} className="focus-ring rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50">Clear expiry</button>}
                      <p className="basis-full text-xs text-ink/55">{document.expiresAt ? `Eligible for cleanup after ${new Date(document.expiresAt).toLocaleDateString()}.` : "No expiry. This document is never eligible for retention cleanup."}</p>
                      <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={document.memberVisible} onChange={(event) => setDocuments((current) => current.map((entry) => entry.id === document.id ? { ...entry, memberVisible: event.target.checked } : entry))} /> Visible to members</label>
                      <button type="button" disabled={savingDocumentId === document.id} onClick={() => void saveDocumentMetadata(document)} className="focus-ring rounded-full border border-coral px-3 py-1.5 text-xs font-semibold text-coral">Save metadata</button>
                    </div>
                  </div>
                )) : <p className="rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No documents uploaded.</p>}
              </div>
            </section>

            <MembershipTimeline key={documents.map((document) => document.id).join(",")} familyId={params.id} />

            <div className="flex items-center justify-between gap-4">
              <button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Save family</button>
              <button type="button" onClick={() => router.back()} className="focus-ring rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold text-ink/70">Cancel</button>
            </div>
            {message && <p role="alert" className="text-sm text-coral">{message}</p>}
          </form>
        ) : <p className="mt-6 text-sm text-coral" role="alert">{message || "Loading family..."}</p>}
      </Container>
    </main>
  );
}
