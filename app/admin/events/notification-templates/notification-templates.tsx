"use client";

import { useEffect, useRef, useState } from "react";

const SMS_MAX_LENGTH = 1600;
const SMART_TAGS = [
  ["volunteerName", "Volunteer name"],
  ["volunteerFirstName", "Volunteer first name"],
  ["volunteerGroupName", "Volunteer group name"],
  ["volunteerGroupSingularName", "Volunteer group singular name"],
  ["eventName", "Event name"],
  ["eventDate", "Event date"],
  ["eventTime", "Event time"],
  ["eventLocation", "Event location"],
  ["eventReadingsUrl", "Event readings URL"],
  ["churchName", "Church name"]
] as const;

type Template = {
  id: number;
  groupId: string | null;
  emailSubject: string;
  emailBodyHtml: string;
  emailDayBeforeSubject: string;
  emailDayBeforeBodyHtml: string;
  smsBody: string;
  smsDayBeforeBody: string;
};
type Group = { id: string; name: string; singularName: string | null };

type EmailEditorProps = { label: string; value: string; onChange: (value: string) => void };
const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const toolbarClass = "focus-ring rounded-md border border-ink/10 px-2 py-1 text-xs font-semibold hover:bg-mist";

function EmailEditor({ label, value, onChange }: EmailEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);
  function saveSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
  }
  function command(name: string, value?: string) {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    document.execCommand(name, false, value);
    onChange(editorRef.current?.innerHTML ?? "");
  }
  return <div className="grid gap-2">
    <label className="text-sm font-semibold">{label}</label>
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-mist/40 p-2">
      <button type="button" className={toolbarClass} onMouseDown={saveSelection} onClick={() => command("bold")}>B</button>
      <button type="button" className={`${toolbarClass} italic`} onMouseDown={saveSelection} onClick={() => command("italic")}>I</button>
      <button type="button" className={`${toolbarClass} underline`} onMouseDown={saveSelection} onClick={() => command("underline")}>U</button>
      <select aria-label={`${label} smart tag`} defaultValue="" onMouseDown={saveSelection} onChange={(event) => { if (event.target.value) command("insertText", `{{${event.target.value}}}`); event.currentTarget.value = ""; }} className={toolbarClass}>
        <option value="" disabled>Insert smart tag</option>
        {SMART_TAGS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={() => onChange(editorRef.current?.innerHTML ?? "")} className="email-editor focus-ring min-h-36 rounded-xl border border-ink/15 p-3 text-sm leading-6" aria-label={label} />
  </div>;
}

function SmsEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  function insertTag(tag: string) {
    const { start, end } = selectionRef.current;
    const next = `${value.slice(0, start)}{{${tag}}}${value.slice(end)}`.slice(0, SMS_MAX_LENGTH);
    onChange(next);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const cursor = Math.min(start + tag.length + 4, next.length);
      inputRef.current?.setSelectionRange(cursor, cursor);
      selectionRef.current = { start: cursor, end: cursor };
    });
  }
  return <div className="grid gap-2">
    <label className="text-sm font-semibold">{label}</label>
    <div className="flex flex-wrap gap-1">{SMART_TAGS.map(([tag, text]) => <button key={tag} type="button" className={toolbarClass} onClick={() => insertTag(tag)}>{text}</button>)}</div>
    <textarea ref={inputRef} value={value} maxLength={SMS_MAX_LENGTH} rows={6} onSelect={(event) => { selectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={(event) => onChange(event.target.value)} className={`${inputClass} resize-y text-sm`} />
    <p className="text-right text-xs text-ink/55">{value.length}/{SMS_MAX_LENGTH} characters</p>
  </div>;
}

export function NotificationTemplates() {
  const [template, setTemplate] = useState<Template | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  useEffect(() => {
    void fetch("/api/events/notification-templates").then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load notification templates.");
      setTemplate(value.template);
      setGroups(value.groups ?? []);
      setGroupId(value.template.groupId ?? "");
    }).catch((reason: Error) => setError(reason.message));
  }, []);
  async function loadTemplate(nextGroupId: string) {
    const response = await fetch("/api/events/notification-templates");
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Unable to load notification templates.");
    const selected = nextGroupId ? await fetch(`/api/events/notification-templates?groupId=${encodeURIComponent(nextGroupId)}`) : null;
    if (selected) {
      const selectedValue = await selected.json();
      if (!selected.ok) throw new Error(selectedValue.error ?? "Unable to load notification template.");
      setTemplate(selectedValue.template);
    } else setTemplate(value.template);
  }
  function update(field: keyof Template, value: string) {
    setTemplate((current) => current ? { ...current, [field]: value } : current);
  }
  async function save() {
    if (!template) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/events/notification-templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...template, groupId }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to save notification templates.");
      setTemplate(value.template);
      setNotice("Notification templates saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save notification templates.");
    } finally {
      setSaving(false);
    }
  }
  if (!template) return <p className="mt-8 text-sm text-ink/60">{error || "Loading notification templates…"}</p>;
  return <div className="mt-8">
    {error && <p role="alert" className="mb-5 rounded-lg border border-coral/30 bg-coral/5 p-3 text-sm text-coral">{error}</p>}
    {notice && <p role="status" className="mb-5 rounded-lg border border-emerald-700/30 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <div className="mb-5 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <label className="grid max-w-xl gap-2 text-sm font-semibold">Template applies to
        <select value={groupId} onChange={(event) => { setGroupId(event.target.value); void loadTemplate(event.target.value).catch((reason: Error) => setError(reason.message)); }} className={inputClass}>
          <option value="">All volunteer groups (default)</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}{group.singularName ? ` — ${group.singularName}` : ""}</option>)}
        </select>
      </label>
      <p className="mt-2 text-xs text-ink/55">A group-specific template overrides the default template for that volunteer group.</p>
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-2xl">Email notifications</h2>
        <p className="mt-1 text-sm text-ink/60">Rich formatting is supported. Smart tags are replaced when the message is sent.</p>
        <div className="mt-5 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">Subject<input value={template.emailSubject} maxLength={200} onChange={(event) => update("emailSubject", event.target.value)} className={inputClass} /></label>
          <EmailEditor label="Email message" value={template.emailBodyHtml} onChange={(value) => update("emailBodyHtml", value)} />
          <div className="border-t border-ink/10 pt-5"><EmailEditor label="24-hour reminder email" value={template.emailDayBeforeBodyHtml} onChange={(value) => update("emailDayBeforeBodyHtml", value)} /></div>
          <label className="grid gap-2 text-sm font-semibold">24-hour reminder subject<input value={template.emailDayBeforeSubject} maxLength={200} onChange={(event) => update("emailDayBeforeSubject", event.target.value)} className={inputClass} /></label>
        </div>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-2xl">SMS notifications</h2>
        <p className="mt-1 text-sm text-ink/60">Keep messages concise. Each SMS template is limited to 1,600 characters.</p>
        <div className="mt-5 grid gap-5">
          <SmsEditor label="SMS message" value={template.smsBody} onChange={(value) => update("smsBody", value)} />
          <div className="border-t border-ink/10 pt-5"><SmsEditor label="24-hour reminder SMS" value={template.smsDayBeforeBody} onChange={(value) => update("smsDayBeforeBody", value)} /></div>
        </div>
      </section>
      <aside className="rounded-2xl border border-ink/10 bg-ink p-5 text-white shadow-sm">
        <h2 className="font-serif text-2xl">Smart tags</h2>
        <p className="mt-1 text-sm text-white/70">Insert these into email or SMS templates. They are replaced with event and volunteer details at send time.</p>
        <dl className="mt-5 grid gap-3">{SMART_TAGS.map(([tag, label]) => <div key={tag} className="flex items-start justify-between gap-3 border-b border-white/15 pb-3"><dt className="text-sm text-white/75">{label}</dt><dd className="rounded bg-white/10 px-2 py-1 font-mono text-xs text-white">{`{{${tag}}}`}</dd></div>)}</dl>
        <div className="mt-6 border-t border-white/15 pt-5 text-sm text-white/75"><p className="font-semibold text-white">Delivery behavior</p><p className="mt-2">The 24-hour versions are used only when “Send a second notification 24 hours before” is enabled on the rotation order.</p></div>
        <button type="button" disabled={saving} onClick={() => void save()} className="focus-ring mt-6 w-full rounded-lg bg-coral px-4 py-3 text-sm font-semibold text-white hover:bg-coral/90 disabled:opacity-60">{saving ? "Saving…" : "Save templates"}</button>
      </aside>
    </div>
  </div>;
}
