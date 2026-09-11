"use client";

import { type ChangeEvent, useRef, useState } from "react";
import {
  MEMBERSHIP_IMPORT_FIELDS,
  getDefaultMembershipImportMapping,
  parseMembershipCsv,
  type MembershipImportField,
  type MembershipImportMapping
} from "@/lib/membership-import-fields";

type DuplicateMode = "skip" | "update" | "create";
type PreviewRow = {
  row: number;
  family: { lastName: string };
  member: { firstName: string; middleName: string | null; lastName: string | null; birthday: string; memberType: string; familyRole: string; email: string | null; status: string };
  errors: string[];
  warnings: string[];
  duplicate: { source: "database" | "csv"; reason: string; row?: number; candidates?: Array<{ id: string; name: string; memberNumber: number }> } | null;
};
type Preview = {
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number; duplicates: number; warnings: number };
  errors: string[];
  warnings: string[];
  ignoredColumns: string[];
  availableFamilyRoles: Array<{ id: string; slug: string; name: string }>;
  availableMemberTypes: Array<{ id: string; slug: string; name: string }>;
  availableCustomFields: Array<{ id: string; slug: string; name: string; appliesTo: "FAMILY" | "INDIVIDUAL" }>;
};
type CommitResult = { rows: number; valid: number; invalid: number; duplicates: number; duplicateMode: DuplicateMode; familiesCreated: number; created: number; updated: number; skipped: number };
type CustomFieldDefinition = { id: string; slug: string; name: string; appliesTo: "FAMILY" | "INDIVIDUAL" };

const SAMPLE_HEADERS = "family_key,family_name,address_street,address_city,address_state,address_zip,family_email,family_phone,first_name,middle_name,last_name,birthday,gender,marital_status,member_type,family_role,email,cellphone,other_phone,other_phone_type,email_consent,sms_consent,status";

export function MembershipImport({ customFields = [] }: { customFields?: CustomFieldDefinition[] }) {
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleValues, setSampleValues] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Array<MembershipImportField | `customField:${string}` | null>>([]);
  const [headerError, setHeaderError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);
  const [sourceSystem, setSourceSystem] = useState("generic");
  const [familyRoleMappings, setFamilyRoleMappings] = useState<Record<string, string>>({});
  const [memberTypeMappings, setMemberTypeMappings] = useState<Record<string, string>>({});
  const [availableCustomFields, setAvailableCustomFields] = useState<Preview["availableCustomFields"]>(customFields);
  const [previewNeedsRefresh, setPreviewNeedsRefresh] = useState(false);
  const previewSectionRef = useRef<HTMLElement>(null);

  function keepPreviewVisible() {
    requestAnimationFrame(() => previewSectionRef.current?.scrollIntoView({ block: "start" }));
  }

  function updateCsv(value: string) {
    setCsv(value);
    setPreview(null);
    setPreviewNeedsRefresh(false);
    setResult(null);
    setMessage("");
    try {
      const parsed = parseMembershipCsv(value);
      setHeaders(parsed.headers);
      setSampleValues(parsed.records[0]?.values ?? []);
      setMapping(getDefaultMembershipImportMapping(parsed.headers, sourceSystem));
      setHeaderError(value.trim() && !parsed.headers.length ? "CSV data must include a header row." : "");
    } catch (error) {
      setHeaders([]);
      setSampleValues([]);
      setMapping([]);
      setHeaderError(error instanceof Error ? error.message : "Unable to read CSV headers.");
    }
  }

  function mappingPayload(): MembershipImportMapping {
    return Object.fromEntries(mapping.map((destination, index) => [`column:${index}`, destination ?? "ignore"])) as MembershipImportMapping;
  }

  function updateMapping(index: number, destination: MembershipImportField | `customField:${string}` | null) {
    setMapping((current) => current.map((value, currentIndex) => currentIndex === index ? destination : value));
    setPreview(null);
    setPreviewNeedsRefresh(false);
    setResult(null);
    setMessage("");
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setResult(null);
    if (file.size > 2 * 1024 * 1024) {
      setMessage("CSV files must be no larger than 2 MB.");
      return;
    }
    updateCsv(await file.text());
  }

  async function requestPreview() {
    if (!csv.trim()) {
      setMessage("Paste CSV data or choose a CSV file first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/membership/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", csv, sourceSystem, mapping: mappingPayload(), valueMappings: { familyRole: familyRoleMappings, memberType: memberTypeMappings } })
      });
      const value = await response.json();
      if (!value.rows) throw new Error(value.error ?? "Unable to preview this CSV.");
      setPreview(value);
      setPreviewNeedsRefresh(false);
      setAvailableCustomFields(value.availableCustomFields ?? []);
      if (!response.ok) setMessage("Resolve the file-level errors before importing.");
    } catch (error) {
      setPreview(null);
      setPreviewNeedsRefresh(false);
      setMessage(error instanceof Error ? error.message : "Unable to preview this CSV.");
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!preview?.summary.valid || preview.errors.length) return;
    if (!window.confirm(`Import ${preview.summary.valid} valid row${preview.summary.valid === 1 ? "" : "s"} using “${duplicateMode}” duplicate handling?`)) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/membership/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", csv, sourceSystem, mapping: mappingPayload(), valueMappings: { familyRole: familyRoleMappings, memberType: memberTypeMappings }, duplicateMode })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to commit this import.");
      setResult(value);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to commit this import.");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${SAMPLE_HEADERS}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "membership-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const duplicateDestinations = new Set(mapping.filter((destination, index) =>
    destination && mapping.indexOf(destination) !== index
  ));
  const mappingReady = headers.length > 0 && !headerError && duplicateDestinations.size === 0;
  const familyRoleColumn = mapping.indexOf("familyRole");
  const familyRoleValues = familyRoleColumn >= 0
    ? Array.from(new Set(parseMembershipCsv(csv).records.map((record) => record.values[familyRoleColumn]?.trim()).filter(Boolean)))
    : [];
  const duplicatePreviewRows = preview?.rows.filter((row) => row.duplicate) ?? [];

  return <div className="mt-8 grid gap-6">
    <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
      <label className="mb-5 grid max-w-xl gap-2 text-sm font-semibold">Source system
        <select value={sourceSystem} onChange={(event) => { const nextSource = event.target.value; setSourceSystem(nextSource); if (headers.length) setMapping(getDefaultMembershipImportMapping(headers, nextSource)); setPreview(null); setPreviewNeedsRefresh(false); }} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">
          <option value="generic">Other / unknown</option>
          <option value="churchtrac">ChurchTrac</option>
          <option value="church360">Church360</option>
        </select>
        <span className="text-xs font-normal text-ink/60">Keeps external member IDs and family keys separate between systems.</span>
      </label>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-serif text-2xl">1. Add CSV data</h2><p className="mt-2 max-w-3xl text-sm text-ink/60">Quoted commas, escaped quotes, and multiline quoted fields are supported. Use a family key to group members in the same household. Dates may be YYYY-MM-DD or M/D/YYYY.</p></div>
        <button type="button" onClick={downloadTemplate} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Download template</button>
      </div>
      <label className="mt-5 grid gap-2 text-sm font-semibold">Choose a CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
      <label className="mt-4 grid gap-2 text-sm font-semibold">Or paste CSV<textarea value={csv} onChange={(event) => updateCsv(event.target.value)} rows={10} spellCheck={false} placeholder={`${SAMPLE_HEADERS}\nsmith,Smith,123 Main St,Milaca,MN,56353,family@example.com,320-555-0100,Jane,,Smith,1980-04-12,Female,Married,Member,Head of Household,jane@example.com,320-555-0101,,,yes,yes,Active`} className="focus-ring rounded-xl border border-ink/15 px-3 py-3 font-mono text-xs font-normal" /></label>
      {headerError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{headerError}</p>}
    </section>

    {!result && headers.length > 0 && <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-serif text-2xl">2. Map CSV fields</h2>
      <p className="mt-2 text-sm text-ink/60">Match each source column to a membership field. Recognized headings are selected automatically; choose Ignore for data you do not want to import.</p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-ink/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wider text-ink/60"><tr><th className="px-3 py-3">CSV column</th><th className="px-3 py-3">Sample value</th><th className="min-w-64 px-3 py-3">Destination field</th></tr></thead>
          <tbody>{headers.map((header, index) => <tr key={`${index}-${header}`} className="border-t border-ink/10">
            <td className="px-3 py-3 font-semibold">{header || <span className="italic text-ink/50">Unnamed column {index + 1}</span>}</td>
            <td className="max-w-64 truncate px-3 py-3 text-ink/60" title={sampleValues[index]}>{sampleValues[index] || "—"}</td>
            <td className="px-3 py-3">
              <select
                aria-label={`Map ${header || `column ${index + 1}`}`}
                value={mapping[index] ?? ""}
                onChange={(event) => updateMapping(index, event.target.value ? event.target.value as MembershipImportField | `customField:${string}` : null)}
                className={`focus-ring w-full rounded-lg border px-3 py-2 ${mapping[index] && duplicateDestinations.has(mapping[index]!) ? "border-red-400" : "border-ink/15"}`}
              >
                <option value="">Ignore</option>
                {MEMBERSHIP_IMPORT_FIELDS.map((field) => <option key={field.value} value={field.value} disabled={mapping.some((value, mappingIndex) => mappingIndex !== index && value === field.value)}>{field.label}</option>)}
                {availableCustomFields.map((field) => <option key={`customField:${field.id}`} value={`customField:${field.id}`} disabled={mapping.some((value, mappingIndex) => mappingIndex !== index && value === `customField:${field.id}`)}>{field.appliesTo === "FAMILY" ? "Family" : "Individual"}: {field.name}</option>)}
              </select>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {duplicateDestinations.size > 0 && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">Each destination field may be assigned only once. Change or ignore the highlighted duplicate mappings.</p>}
      <p className="mt-3 text-sm text-ink/60">
        Ignored/unmapped columns: {headers.flatMap((header, index) => mapping[index] ? [] : [header || `Unnamed column ${index + 1}`]).join(", ") || "None"}
      </p>
      <button type="button" disabled={busy || !csv.trim() || !mappingReady} onClick={() => void requestPreview()} className="focus-ring mt-4 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Checking…" : "Preview mapped import"}</button>
    </section>}

    {message && !result && <p role="status" className="rounded-xl border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">{message}</p>}
    {result && <section className="rounded-2xl border border-green-300 bg-green-50 p-5"><h2 className="font-serif text-2xl text-green-950">Import committed</h2><p className="mt-2 text-sm text-green-900">{result.familiesCreated} families created · {result.created} members created · {result.updated} members updated · {result.skipped} duplicates skipped · {result.invalid} invalid rows excluded</p><a href="/admin/membership" className="focus-ring mt-4 inline-block rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white">View directory</a></section>}

    {!result && preview && <section ref={previewSectionRef} id="review-preview" className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-serif text-2xl">3. Review preview</h2>
      {previewNeedsRefresh && <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Mapping changes are ready. Preview again to refresh the results below.</p>}
      {familyRoleValues.length > 0 && <div className="mt-5 rounded-xl border border-ink/10 bg-mist p-4">
        <h3 className="font-semibold">Map imported family roles</h3>
        <p className="mt-1 text-sm text-ink/60">ChurchTrac role names do not need to match St. Paul’s roles. Choose the existing role each imported value should become; no new roles will be created.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {familyRoleValues.map((value) => <label key={value} className="grid gap-1 text-sm font-semibold">
            <span>{value}</span>
            <select
              value={familyRoleMappings[value.toLowerCase()] ?? ""}
              onChange={(event) => {
                const selected = event.target.value;
                setFamilyRoleMappings((current) => ({ ...current, [value.toLowerCase()]: selected }));
                setPreviewNeedsRefresh(true);
                setResult(null);
                keepPreviewVisible();
              }}
              className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"
            >
              <option value="">Choose an existing role</option>
              {preview.availableFamilyRoles.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
            </select>
          </label>)}
        </div>
        {familyRoleValues.some((value) => !familyRoleMappings[value.toLowerCase()]) && <p className="mt-3 text-sm text-coral">Map every imported role, then preview again.</p>}
        <button type="button" disabled={busy || familyRoleValues.some((value) => !familyRoleMappings[value.toLowerCase()])} onClick={() => void requestPreview()} className="focus-ring mt-4 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold">Preview with role mappings</button>
      </div>}
      {Array.from(new Set(parseMembershipCsv(csv).records.map((record) => record.values[mapping.indexOf("memberType")]?.trim()).filter(Boolean))).length > 0 && <div className="mt-5 rounded-xl border border-ink/10 bg-mist p-4">
        <h3 className="font-semibold">Map imported member types</h3>
        <p className="mt-1 text-sm text-ink/60">Assign each imported ChurchTrac value to an existing St. Paul’s member type.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from(new Set(parseMembershipCsv(csv).records.map((record) => record.values[mapping.indexOf("memberType")]?.trim()).filter(Boolean))).map((value) => <label key={value} className="grid gap-1 text-sm font-semibold"><span>{value}</span><select value={memberTypeMappings[value.toLowerCase()] ?? ""} onChange={(event) => { setMemberTypeMappings((current) => ({ ...current, [value.toLowerCase()]: event.target.value })); setPreviewNeedsRefresh(true); keepPreviewVisible(); }} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">Choose an existing type</option>{preview.availableMemberTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select></label>)}
        </div>
        <button type="button" disabled={busy} onClick={() => void requestPreview()} className="focus-ring mt-4 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold">Preview with type mappings</button>
      </div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {[["Rows", preview.summary.total], ["Valid", preview.summary.valid], ["Invalid", preview.summary.invalid], ["Duplicates", preview.summary.duplicates], ["Warnings", preview.summary.warnings]].map(([label, value]) => <div key={label} className={`rounded-xl p-3 ${label === "Duplicates" && preview.summary.duplicates > 0 ? "border border-amber-300 bg-amber-50" : "bg-mist"}`}><p className="text-xs font-semibold uppercase tracking-wider text-ink/55">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
      </div>
      {duplicatePreviewRows.length > 0 && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Duplicate rows need review</p>
        <p className="mt-1">Rows {duplicatePreviewRows.map((row) => row.row).join(", ")} match another imported row or an existing member.</p>
        <div className="mt-2 grid gap-1 text-amber-900">{duplicatePreviewRows.map((row) => <p key={row.row}>Row {row.row}: {row.duplicate?.reason}{row.duplicate?.row ? ` (first seen on row ${row.duplicate.row})` : ""}</p>)}</div>
      </div>}
      {(preview.errors.length > 0 || preview.warnings.length > 0) && <div className="mt-4 grid gap-2 text-sm">
        {preview.errors.map((error) => <p key={error} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-900">{error}</p>)}
        {preview.warnings.map((warning) => <p key={warning} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">{warning}</p>)}
      </div>}
      <p className="mt-4 text-sm text-ink/60">Ignored/unmapped columns: {preview.ignoredColumns.join(", ") || "None"}</p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-ink/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wider text-ink/60"><tr><th className="px-3 py-3">Row</th><th className="px-3 py-3">Family</th><th className="px-3 py-3">Member</th><th className="px-3 py-3">Type / role</th><th className="px-3 py-3">Status</th><th className="min-w-72 px-3 py-3">Validation</th></tr></thead>
          <tbody>{preview.rows.map((row) => <tr key={row.row} className={`border-t border-ink/10 align-top ${row.duplicate ? "bg-amber-50/70" : ""}`}>
            <td className="px-3 py-3 font-semibold">{row.row}{row.duplicate && <span className="mt-1 block w-fit rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Duplicate</span>}</td>
            <td className="px-3 py-3">{row.family.lastName || "—"}</td>
            <td className="px-3 py-3"><span className="font-semibold">{[row.member.firstName, row.member.middleName, row.member.lastName].filter(Boolean).join(" ") || "—"}</span><span className="block text-xs text-ink/55">{row.member.birthday === "1900-01-01" ? "No birthday" : row.member.birthday}{row.member.email ? ` · ${row.member.email}` : ""}</span></td>
            <td className="px-3 py-3">{row.member.memberType || "—"}<span className="block text-xs text-ink/55">{row.member.familyRole || "—"}</span></td>
            <td className="px-3 py-3">{row.member.status.toLowerCase()}</td>
            <td className="px-3 py-3">
              {!row.errors.length && !row.warnings.length && <span className="font-semibold text-green-700">Ready</span>}
              {row.errors.map((error) => <span key={error} className="block text-red-700">Error: {error}</span>)}
              {row.warnings.map((warning) => <span key={warning} className="block text-amber-700">Warning: {warning}</span>)}
              {row.duplicate?.candidates?.map((candidate) => <span key={candidate.id} className="block text-xs text-ink/60">Matches #{candidate.memberNumber} {candidate.name}</span>)}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {!preview.rows.length && <p className="mt-4 text-sm text-ink/60">No data rows were found.</p>}
    </section>}

    {!result && preview && <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-serif text-2xl">4. Commit valid rows</h2>
      <p className="mt-2 text-sm text-ink/60">Invalid rows are excluded. All database changes and the audit record are committed together; if any write fails, the entire import is rolled back.</p>
      <label className="mt-5 grid max-w-xl gap-2 text-sm font-semibold">When a possible duplicate is found
        <select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateMode)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">
          <option value="skip">Skip the imported duplicate</option>
          <option value="update">Update the matching existing member</option>
          <option value="create">Create a separate member anyway</option>
        </select>
      </label>
      <button type="button" disabled={busy || previewNeedsRefresh || !preview.summary.valid || preview.errors.length > 0 || Boolean(result)} onClick={() => void commitImport()} className="focus-ring mt-5 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Importing…" : previewNeedsRefresh ? "Preview again before importing" : `Commit ${preview.summary.valid} valid row${preview.summary.valid === 1 ? "" : "s"}`}</button>
    </section>}
  </div>;
}
