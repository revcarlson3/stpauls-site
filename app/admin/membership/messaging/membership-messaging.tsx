"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMAIL_ATTACHMENT_TYPES,
  EMAIL_SAFE_FONTS,
  MERGE_TAGS,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  htmlToText
} from "@/lib/membership-messaging";

type Recipient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailEligible: boolean;
  smsEligible: boolean;
  emailReason: string | null;
  smsReason: string | null;
};

type Template = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  builtIn: boolean;
};

type Attachment = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
};

type Props = { initialMemberIds: string[]; initialTarget?: string; initialAudienceId?: string };
type HistoryRecipient = { id: string; displayName: string; address: string; status: string; attemptCount: number; failureReason: string | null; deliveryAttempts: { status: string; error: string | null; attemptedAt: string }[] };
type HistoryMessage = { id: string; channel: "EMAIL" | "SMS"; subject: string | null; status: string; deliveryNote: string | null; createdAt: string; createdBy: { name: string }; recipients: HistoryRecipient[] };
type MessageTarget = "selected-members" | "volunteer-group" | "member-type" | "manual-list" | "dynamic-list";
type Alignment = "left" | "center" | "right" | "full";

const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const toolbarButtonClass = "focus-ring rounded-md border border-ink/10 px-2 py-1 text-xs font-semibold hover:bg-mist";
const DEFAULT_BODY_HTML = "<p>Dear {{firstName}},</p><p>Write your message here.</p>";

function AlignmentIcon({ alignment }: { alignment: Alignment }) {
  const lines = alignment === "full"
    ? [[2, 20], [2, 20], [2, 20], [2, 20]]
    : alignment === "left"
      ? [[2, 18], [2, 14], [2, 16], [2, 11]]
      : alignment === "right"
        ? [[4, 20], [8, 20], [6, 20], [11, 20]]
        : [[4, 18], [2, 20], [4, 18], [6, 16]];

  return <svg aria-hidden="true" viewBox="0 0 22 16" className="h-4 w-4 fill-current">{lines.map(([x1, x2], index) => <rect key={index} x={x1} y={index * 4} width={x2 - x1} height="2" rx="1" />)}</svg>;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

export function MembershipMessaging({ initialMemberIds, initialTarget, initialAudienceId }: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_BODY_HTML);
  const [smsBody, setSmsBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [provider, setProvider] = useState({ emailConfigured: false, smsConfigured: false, churchName: "St. Paul's" });
  const [recipientLimit, setRecipientLimit] = useState(200);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [retrying, setRetrying] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sentChannels, setSentChannels] = useState<("EMAIL" | "SMS")[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<MessageTarget | "">((initialTarget as MessageTarget) || (initialMemberIds.some((id) => id.trim()) ? "selected-members" : ""));
  const [audienceId, setAudienceId] = useState(initialAudienceId ?? "");
  const [audiences, setAudiences] = useState<{ groups: { id: string; name: string; _count: { members: number } }[]; manualLists: { id: string; name: string; _count: { members: number } }[]; dynamicLists: { id: string; name: string; count?: number }[]; memberTypes: { id: string; name: string; _count: { individuals: number } }[] }>({ groups: [], manualLists: [], dynamicLists: [], memberTypes: [] });
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [imageWidth, setImageWidth] = useState(100);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const smsSelectionRef = useRef({ start: 0, end: 0 });
  const imageIdRef = useRef(0);
  const resizeRef = useRef<{ imageId: string; startX: number; startWidth: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const smsInputRef = useRef<HTMLTextAreaElement>(null);
  const memberIds = useMemo(() => Array.from(new Set(initialMemberIds.map((id) => id.trim()).filter(Boolean))), [initialMemberIds]);

  useEffect(() => {
    const params = new URLSearchParams({ targetType: target || "selected-members", ...(audienceId ? { audienceId } : {}) });
    memberIds.forEach((id) => params.append("memberId", id));
    void fetch(`/api/membership/messaging?${params.toString()}`)
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Unable to load recipients.");
        setRecipients(value.recipients ?? []);
        setTemplates(value.templates ?? []);
        setAudiences(value.audiences ?? { groups: [], manualLists: [], dynamicLists: [], memberTypes: [] });
        setProvider(value.provider ?? { emailConfigured: false, smsConfigured: false, churchName: "St. Paul's" });
        setRecipientLimit(value.recipientLimit ?? 200);
        const firstTemplate = value.templates?.[0] as Template | undefined;
        if (firstTemplate) {
          setTemplateId(firstTemplate.id);
          setSubject(firstTemplate.subject);
          setBodyHtml(firstTemplate.bodyHtml);
          if (editorRef.current) editorRef.current.innerHTML = firstTemplate.bodyHtml;
        } else if (editorRef.current) {
          editorRef.current.innerHTML = DEFAULT_BODY_HTML;
        }
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [memberIds, target, audienceId]);

  useEffect(() => {
    void fetch("/api/membership/messaging/history").then((response) => response.ok ? response.json() : []).then((value) => setHistory(Array.isArray(value) ? value : [])).catch(() => undefined);
  }, [sentChannels]);

  useEffect(() => {
    if (channel === "EMAIL" && editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml;
    }
  }, [channel, bodyHtml]);

  const emailEligible = recipients.filter((recipient) => recipient.emailEligible);
  const smsEligible = recipients.filter((recipient) => recipient.smsEligible);
  const eligible = channel === "EMAIL" ? emailEligible : smsEligible;
  const selectedImageNumber = selectedImageId && editorRef.current
    ? Array.from(editorRef.current.querySelectorAll("img")).findIndex((image) => image.dataset.imageId === selectedImageId) + 1
    : 0;

  function syncEditor() {
    setBodyHtml(editorRef.current?.innerHTML ?? "");
  }

  function cleanEditorHtml(html: string) {
    return html.replace(/\sdata-selected="true"/gi, "");
  }

  function saveEditorSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  }

  function restoreEditorSelection() {
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!selection || !range || !editorRef.current || !editorRef.current.contains(range.commonAncestorContainer)) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    restoreEditorSelection();
    document.execCommand(command, false, value);
    syncEditor();
  }

  function applyTextStyle(style: string) {
    if (!style) return;
    editorRef.current?.focus();
    restoreEditorSelection();
    document.execCommand("formatBlock", false, `<${style}>`);
    syncEditor();
  }

  function insertMergeTag(tag: typeof MERGE_TAGS[number]["value"]) {
    editorRef.current?.focus();
    restoreEditorSelection();
    document.execCommand("insertText", false, `{{${tag}}}`);
    syncEditor();
  }

  function insertSmsMergeTag(tag: typeof MERGE_TAGS[number]["value"]) {
    const textarea = smsInputRef.current;
    if (!textarea) return;
    const { start, end } = smsSelectionRef.current;
    const insertion = `{{${tag}}}`;
    setSmsBody((current) => current.slice(0, start) + insertion + current.slice(end));
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
      smsSelectionRef.current = { start: cursor, end: cursor };
    });
  }

  function selectImage(image: HTMLImageElement | null) {
    editorRef.current?.querySelectorAll("img[data-selected='true']").forEach((entry) => entry.removeAttribute("data-selected"));
    if (image && !image.dataset.imageId) {
      imageIdRef.current += 1;
      image.dataset.imageId = `embedded-image-${imageIdRef.current}`;
    }
    if (image) image.dataset.selected = "true";
    setSelectedImage(image);
    setSelectedImageId(image?.dataset.imageId ?? "");
    if (image) {
      const width = Number.parseInt(image.style.width || image.getAttribute("width") || "100", 10);
      setImageWidth(Number.isFinite(width) ? Math.min(100, Math.max(10, width)) : 100);
    }
  }

  function updateImageWidth(nextWidth: number) {
    const width = Math.min(100, Math.max(10, Math.round(nextWidth)));
    setImageWidth(width);
    if (!selectedImageId || !editorRef.current) return;
    const image = editorRef.current.querySelector<HTMLImageElement>(`img[data-image-id="${selectedImageId}"]`);
    if (!image) return;
    image.style.width = `${width}%`;
    image.style.maxWidth = "100%";
    image.style.height = "auto";
    image.setAttribute("width", `${width}%`);
    image.removeAttribute("height");
    syncEditor();
  }

  function alignImage(alignment: Alignment) {
    if (!selectedImageId || !editorRef.current) {
      runCommand(alignment === "full" ? "justifyFull" : `justify${alignment[0].toUpperCase()}${alignment.slice(1)}`);
      return;
    }
    const image = editorRef.current.querySelector<HTMLImageElement>(`img[data-image-id="${selectedImageId}"]`);
    if (!image) return;
    image.style.maxWidth = alignment === "left" || alignment === "right" ? "calc(100% - 1rem)" : "100%";
    image.style.height = "auto";
    image.style.float = alignment === "left" || alignment === "right" ? alignment : "none";
    image.style.display = alignment === "left" || alignment === "right" ? "inline" : "block";
    image.style.margin = alignment === "left" ? "0 1rem 0.5rem 0" : alignment === "right" ? "0 0 0.5rem 1rem" : "0 auto";
    image.setAttribute("align", alignment === "full" ? "center" : alignment);
    if (alignment === "full") {
      image.style.width = "100%";
      image.setAttribute("width", "100%");
    }
    syncEditor();
  }

  function updateResizeCursor(event: React.PointerEvent<HTMLDivElement>) {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image) {
      event.currentTarget.style.cursor = "";
      return;
    }
    const bounds = image.getBoundingClientRect();
    event.currentTarget.style.cursor = event.clientX >= bounds.right - 18 ? "ew-resize" : "pointer";
  }

  function beginImageResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLImageElement)) return;
    const image = event.target;
    const bounds = image.getBoundingClientRect();
    selectImage(image);
    if (event.clientX < bounds.right - 18) return;
    const width = Number.parseInt(image.style.width || "100", 10);
    resizeRef.current = {
      imageId: image.dataset.imageId ?? "",
      startX: event.clientX,
      startWidth: Number.isFinite(width) ? width : 100
    };
    event.preventDefault();
  }

  useEffect(() => {
    function resizeImage(event: PointerEvent) {
      const resize = resizeRef.current;
      if (!resize || !editorRef.current) return;
      const image = editorRef.current.querySelector<HTMLImageElement>(`img[data-image-id="${resize.imageId}"]`);
      if (!image) return;
      const editorWidth = editorRef.current.getBoundingClientRect().width;
      const nextWidth = resize.startWidth + ((event.clientX - resize.startX) / editorWidth) * 100;
      const width = Math.min(100, Math.max(10, Math.round(nextWidth)));
      setImageWidth(width);
      image.style.width = `${width}%`;
      image.style.maxWidth = "100%";
      image.style.height = "auto";
      image.setAttribute("width", `${width}%`);
      image.removeAttribute("height");
      syncEditor();
    }

    function finishImageResize() {
      resizeRef.current = null;
    }

    window.addEventListener("pointermove", resizeImage);
    window.addEventListener("pointerup", finishImageResize);
    return () => {
      window.removeEventListener("pointermove", resizeImage);
      window.removeEventListener("pointerup", finishImageResize);
    };
  }, []);

  function addLink() {
    const url = window.prompt("Enter a secure link (https:// or mailto:)");
    if (!url || !/^(https:\/\/|mailto:)/i.test(url.trim())) return;
    runCommand("createLink", url.trim());
  }

  function applyTemplate(id: string) {
    const template = templates.find((entry) => entry.id === id);
    setTemplateId(id);
    if (!template) return;
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    selectImage(null);
    if (editorRef.current) editorRef.current.innerHTML = template.bodyHtml;
  }

  async function embedImage(file: File) {
    const safeImageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
    if (!safeImageTypes.has(file.type) || file.size > 1_500_000) {
      setError("Embedded images must be PNG, JPEG, GIF, or WebP files under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      editorRef.current?.focus();
      restoreEditorSelection();
      document.execCommand("insertImage", false, reader.result);
      const images = editorRef.current?.querySelectorAll("img");
      const image = images?.[images.length - 1] ?? null;
      selectImage(image);
      if (image) {
        image.style.width = "100%";
        image.style.maxWidth = "100%";
        image.style.height = "auto";
        image.setAttribute("width", "100%");
        image.setAttribute("align", "center");
        image.removeAttribute("height");
      }
      syncEditor();
    };
    reader.readAsDataURL(file);
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const next = [...attachments];
    let total = next.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
    for (const file of Array.from(files)) {
      if (!EMAIL_ATTACHMENT_TYPES.has(file.type) || file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is not an approved email-safe file type or is over 5 MB.`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_ATTACHMENT_BYTES || next.length >= 10) {
        setError("Attachments are limited to 10 files and 10 MB total.");
        break;
      }
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Unable to read attachment."));
        reader.readAsDataURL(file);
      });
      if (!contentBase64) continue;
      next.push({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, contentBase64 });
      total += file.size;
    }
    setAttachments(next);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  async function saveTemplate() {
    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (selectedTemplate && !selectedTemplate.builtIn) {
      const response = await fetch("/api/membership/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplate.id, subject, bodyHtml: cleanEditorHtml(bodyHtml) })
      });
      const value = await response.json();
      if (!response.ok) {
        setError(value.error ?? "Unable to update the message template.");
        return;
      }
      setTemplates((current) => current.map((template) => template.id === selectedTemplate.id ? { ...template, ...value.template, builtIn: false } : template));
      setSaveTemplateOpen(false);
      setNotice("Template updated.");
      return;
    }
    if (!templateName.trim()) {
      setError("Enter a name for the reusable template.");
      return;
    }
    setError("");
    const response = await fetch("/api/membership/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName, subject, bodyHtml: cleanEditorHtml(bodyHtml) })
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to save template.");
      return;
    }
    setTemplates((current) => [{ ...value.template, bodyText: value.template.bodyText ?? htmlToText(value.template.bodyHtml), builtIn: false }, ...current]);
    setTemplateId(value.template.id);
    setTemplateName("");
    setSaveTemplateOpen(false);
    setNotice("Reusable template saved.");
  }

  async function deleteTemplate() {
    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (!selectedTemplate || selectedTemplate.builtIn || !window.confirm(`Delete “${selectedTemplate.name}”?`)) return;
    const response = await fetch(`/api/membership/templates?id=${encodeURIComponent(selectedTemplate.id)}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to delete the message template.");
      return;
    }
    setTemplates((current) => current.filter((template) => template.id !== selectedTemplate.id));
    setTemplateId("");
    setSubject("");
    setBodyHtml(DEFAULT_BODY_HTML);
    if (editorRef.current) editorRef.current.innerHTML = DEFAULT_BODY_HTML;
    setSaveTemplateOpen(false);
    setNotice("Template deleted.");
  }

  async function submitMessage(sendChannel: "EMAIL" | "SMS" = channel) {
    setError("");
    setNotice("");
    const messageBody = sendChannel === "EMAIL" ? htmlToText(bodyHtml) : smsBody.trim();
    if (!target) {
      setError("Choose a message target before saving.");
      return;
    }
    if (target !== "selected-members" && !audienceId) {
      setError("Choose a specific audience before saving.");
      return;
    }
    const sendEligible = sendChannel === "EMAIL" ? emailEligible : smsEligible;
    if (!sendEligible.length) {
      setError(memberIds.length ? `No selected members are eligible for ${sendChannel === "EMAIL" ? "email" : "SMS"} messaging.` : "Choose members from the directory before sending.");
      return;
    }
    if (!messageBody) {
      setError(`Write a ${sendChannel === "EMAIL" ? "email" : "SMS"} message before sending.`);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/membership/messaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: target,
          audienceId: target === "selected-members" ? undefined : audienceId,
          memberIds: target === "selected-members" ? memberIds : [],
          channel: sendChannel,
          subject,
          bodyHtml: sendChannel === "EMAIL" ? cleanEditorHtml(bodyHtml) : `<p>${smsBody.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`,
          bodyText: messageBody,
          attachments: sendChannel === "EMAIL" ? attachments : []
        })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to save message.");
      setSentChannels((current) => current.includes(sendChannel) ? current : [...current, sendChannel]);
      const resultLabel = value.message.status === "SENT" ? "delivered" : value.message.status === "FAILED" ? "failed" : "partially delivered";
      setNotice(`${value.message.recipientCount} ${sendChannel === "EMAIL" ? "email" : "SMS"} recipient${value.message.recipientCount === 1 ? "" : "s"} ${resultLabel}${value.excludedCount ? `; ${value.excludedCount} ineligible member${value.excludedCount === 1 ? "" : "s"} excluded` : ""}. ${value.message.deliveryNote}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save message.");
    } finally {
      setSubmitting(false);
    }
  }

  async function retryFailed(messageId: string) {
    setRetrying(messageId);
    setError("");
    try {
      const response = await fetch("/api/membership/messaging/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to retry failed recipients.");
      setNotice(value.deliveryNote);
      const refreshed = await fetch("/api/membership/messaging/history").then((result) => result.json());
      setHistory(Array.isArray(refreshed) ? refreshed : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retry failed recipients.");
    } finally {
      setRetrying("");
    }
  }

  async function submitBothMessages() {
    if (!emailEligible.length && !smsEligible.length) {
      setError("Email or SMS needs at least one eligible recipient.");
      return;
    }

    setSubmitting(true);
    try {
      if (emailEligible.length && !sentChannels.includes("EMAIL")) await submitMessage("EMAIL");
      if (smsEligible.length && !sentChannels.includes("SMS")) await submitMessage("SMS");
      setNotice(`${emailEligible.length ? "Email" : ""}${emailEligible.length && smsEligible.length ? " and " : ""}${smsEligible.length ? "SMS" : ""} sent to all eligible recipients.`);
    } finally {
      setSubmitting(false);
    }

  }

  if (loading) return <p className="mt-8 text-sm text-ink/60">Loading messaging tools…</p>;

  return <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.6fr)]">
    <aside className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <label className="grid gap-1 text-sm font-semibold">
        Message target
        <select value={target} onChange={(event) => { setTarget(event.target.value as MessageTarget | ""); setAudienceId(""); setError(""); }} className={inputClass}>
          <option value="">Choose a target…</option>
          <option value="selected-members">Selected members{memberIds.length ? ` (${memberIds.length})` : " (none selected)"}</option>
          <option value="volunteer-group">Volunteer group</option>
          <option value="member-type">Member type</option>
          <option value="manual-list">Manual list</option>
          <option value="dynamic-list">Dynamic list</option>
        </select>
      </label>
      {target === "volunteer-group" && <select value={audienceId} onChange={(event) => setAudienceId(event.target.value)} className={`${inputClass} mt-3 w-full`}><option value="">Choose a volunteer group...</option>{audiences.groups.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry._count.members})</option>)}</select>}
      {target === "member-type" && <select value={audienceId} onChange={(event) => setAudienceId(event.target.value)} className={`${inputClass} mt-3 w-full`}><option value="">Choose a member type...</option>{audiences.memberTypes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry._count.individuals})</option>)}</select>}
      {target === "manual-list" && <select value={audienceId} onChange={(event) => setAudienceId(event.target.value)} className={`${inputClass} mt-3 w-full`}><option value="">Choose a manual list...</option>{audiences.manualLists.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry._count.members})</option>)}</select>}
      {target === "dynamic-list" && <select value={audienceId} onChange={(event) => setAudienceId(event.target.value)} className={`${inputClass} mt-3 w-full`}><option value="">Choose a dynamic list...</option>{audiences.dynamicLists.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.count === undefined ? "" : ` (${entry.count})`}</option>)}</select>}
      <div className="mt-6 border-t border-ink/10 pt-5">
        <h2 className="font-serif text-2xl">Recipients</h2>
        {target && (target === "selected-members" ? memberIds.length > 0 : audienceId) ? <>
          <p className="mt-1 text-sm text-ink/60">{recipients.length} selected · {eligible.length} eligible for {channel === "EMAIL" ? "email" : "SMS"} · limit {recipientLimit.toLocaleString()}</p>
          <div className="mt-5 grid gap-2">
            {recipients.map((recipient) => {
              const isEligible = channel === "EMAIL" ? recipient.emailEligible : recipient.smsEligible;
              const address = channel === "EMAIL" ? recipient.email : recipient.phone;
              return <div key={recipient.id} className={`rounded-xl border p-3 ${isEligible ? "border-ink/10" : "border-ink/10 bg-mist/50 opacity-75"}`}><div className="flex items-start gap-2"><span aria-hidden="true" className={`mt-0.5 text-sm ${isEligible ? "text-emerald-700" : "text-ink/40"}`}>{isEligible ? "✓" : "—"}</span><div className="min-w-0"><p className="text-sm font-semibold">{recipient.name}</p><p className="truncate text-xs text-ink/55">{isEligible ? address : (channel === "EMAIL" ? recipient.emailReason : recipient.smsReason)}</p></div></div></div>;
            })}
          </div>
          <div className="mt-5 border-t border-ink/10 pt-4 text-xs text-ink/60"><p><strong className="text-ink">Eligible</strong> members have opted in and have a usable {channel === "EMAIL" ? "email address" : "mobile number"}.</p><p className="mt-2">Ineligible members stay visible for an auditable recipient review and are never sent a message.</p></div>
        </> : <div className="mt-4 rounded-xl bg-mist/50 p-4 text-sm text-ink/65"><p className="font-semibold text-ink">{target === "selected-members" ? "No members are currently selected." : target ? "Choose an audience." : "Choose a target to see recipients."}</p><p className="mt-1">{target === "selected-members" ? "Return to the directory, select members, and choose Message selected to bring them here." : target ? "Select an audience above to resolve its current members." : "You can compose your message now, then select an audience when you are ready."}</p></div>}
      </div>
    </aside>
    <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-5">
        <div><h2 className="font-serif text-2xl">Compose</h2><p className="mt-1 text-sm text-ink/60">Use a built-in starting point or save your own reusable template.</p></div>
        <div className="flex rounded-full border border-ink/15 bg-mist/50 p-1" aria-label="Message channel">
          <button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${channel === "EMAIL" ? "bg-ink text-white" : "text-ink/70"}`} onClick={() => setChannel("EMAIL")}>Email <span className="text-xs font-normal">({emailEligible.length})</span></button>
          <button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${channel === "SMS" ? "bg-ink text-white" : "text-ink/70"}`} onClick={() => setChannel("SMS")}>SMS <span className="text-xs font-normal">({smsEligible.length})</span></button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-coral/30 bg-coral/5 p-3 text-sm text-coral">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {channel === "EMAIL" ? <div className="mt-5 grid gap-4">
        <label className="grid gap-1 text-sm font-semibold">Start with a template<select value={templateId} onChange={(event) => applyTemplate(event.target.value)} className={inputClass}><option value="">Blank message</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.builtIn ? " · built in" : " · saved"}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Subject<input value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} className={inputClass} placeholder="A clear, helpful subject" /></label>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-mist/40 p-2" aria-label="Email formatting toolbar">
            <select aria-label="Email-friendly font" defaultValue="Arial" onMouseDown={saveEditorSelection} onChange={(event) => runCommand("fontName", event.target.value)} className="focus-ring rounded-md border border-ink/10 bg-white px-2 py-1 text-xs"><option value="" disabled>Font</option>{EMAIL_SAFE_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select>
            <select aria-label="Insert merge tag" defaultValue="" onMouseDown={saveEditorSelection} onChange={(event) => { const tag = event.target.value as typeof MERGE_TAGS[number]["value"]; if (tag) insertMergeTag(tag); event.currentTarget.value = ""; }} className="focus-ring rounded-md border border-ink/10 bg-white px-2 py-1 text-xs"><option value="" disabled>Merge tag</option>{MERGE_TAGS.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}</select>
            <span className="mx-1 h-5 w-px bg-ink/10" aria-hidden="true" />
            <button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={() => runCommand("bold")} title="Bold">B</button><button type="button" className={`${toolbarButtonClass} italic`} onMouseDown={saveEditorSelection} onClick={() => runCommand("italic")} title="Italic">I</button><button type="button" className={`${toolbarButtonClass} underline`} onMouseDown={saveEditorSelection} onClick={() => runCommand("underline")} title="Underline">U</button><select aria-label="Text style" defaultValue="" onMouseDown={saveEditorSelection} onChange={(event) => { applyTextStyle(event.target.value); event.currentTarget.value = ""; }} className="focus-ring rounded-md border border-ink/10 bg-white px-2 py-1 text-xs"><option value="" disabled>Text style</option><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select><button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={addLink} title="Add link">Link</button>
            <span className="mx-1 h-5 w-px bg-ink/10" aria-hidden="true" />
            <button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={() => alignImage("left")} title="Wrap text left" aria-label="Wrap text left"><AlignmentIcon alignment="left" /></button><button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={() => alignImage("center")} title="Center image" aria-label="Center image"><AlignmentIcon alignment="center" /></button><button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={() => alignImage("right")} title="Wrap text right" aria-label="Wrap text right"><AlignmentIcon alignment="right" /></button><button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={() => alignImage("full")} title="Full-width image" aria-label="Full-width image"><AlignmentIcon alignment="full" /></button>
            <button type="button" className={toolbarButtonClass} onMouseDown={saveEditorSelection} onClick={() => imageInputRef.current?.click()} title="Embed image">Image</button>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void embedImage(file); event.currentTarget.value = ""; }} />
          </div>
          {selectedImage && <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-coral/40 bg-coral/5 p-2 text-xs">
            <span className="font-semibold text-ink">Image {selectedImageNumber || ""} selected · width</span>
            {[25, 50, 75, 100].map((width) => <button key={width} type="button" className={`${toolbarButtonClass} ${imageWidth === width ? "bg-ink text-white" : ""}`} onClick={() => updateImageWidth(width)}>{width}%</button>)}
            <input aria-label="Image width percentage" type="range" min="10" max="100" value={imageWidth} onChange={(event) => updateImageWidth(Number(event.target.value))} className="h-1.5 w-28 accent-coral" />
            <span className="w-10 text-right tabular-nums text-ink/60">{imageWidth}%</span>
          </div>}
          <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} onPointerMove={updateResizeCursor} onPointerLeave={(event) => { event.currentTarget.style.cursor = ""; }} onPointerDown={beginImageResize} onClick={(event) => { const image = event.target instanceof HTMLImageElement ? event.target : null; selectImage(image); }} className="email-editor focus-ring min-h-72 rounded-xl border border-ink/15 p-4 text-[15px] leading-7" aria-label="Email message body" />
          <p className="mt-2 text-xs text-ink/55">{selectedImage ? "Image selected. Adjust its width above or drag its right edge; alignment controls apply to this image." : "Select an embedded image to adjust its width or alignment. Drag its right edge to resize."}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink/55">Links are restricted to HTTPS or mailto URLs. Images are embedded into the email.</p><div className="flex flex-wrap gap-2">{templates.find((template) => template.id === templateId && !template.builtIn) && <button type="button" className="focus-ring rounded-full border border-coral/40 px-4 py-2 text-sm font-semibold text-coral" onClick={() => void deleteTemplate()}>Delete template</button>}<button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={() => setSaveTemplateOpen((open) => !open)}>{templates.find((template) => template.id === templateId && !template.builtIn) ? "Update template" : "Save as template"}</button></div></div>
        {saveTemplateOpen && <div className="flex flex-wrap items-end gap-2 rounded-xl bg-mist/50 p-3">{!templates.find((template) => template.id === templateId && !template.builtIn) && <label className="grid flex-1 gap-1 text-xs font-semibold">Template name<input value={templateName} maxLength={100} onChange={(event) => setTemplateName(event.target.value)} className={inputClass} placeholder="e.g. Monthly newsletter" /></label>}<button type="button" className="focus-ring rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={() => void saveTemplate()}>{templates.find((template) => template.id === templateId && !template.builtIn) ? "Update template" : "Save template"}</button></div>}
        <div className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Attachments</h3><p className="mt-1 text-xs text-ink/55">PDF, Office, text, CSV, and common image files · 5 MB each · 10 MB total.</p></div><button type="button" className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-xs font-semibold" onClick={() => attachmentInputRef.current?.click()}>Add attachment</button><input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={(event) => { void addAttachments(event.target.files); }} /></div>{attachments.length > 0 && <ul className="mt-3 grid gap-2 text-sm">{attachments.map((attachment) => <li key={`${attachment.fileName}-${attachment.sizeBytes}`} className="flex items-center justify-between gap-3 rounded-lg bg-mist/50 px-3 py-2"><span className="truncate">{attachment.fileName} <span className="text-xs text-ink/55">({formatBytes(attachment.sizeBytes)})</span></span><button type="button" className="focus-ring text-xs font-semibold text-coral" onClick={() => setAttachments((current) => current.filter((entry) => entry !== attachment))}>Remove</button></li>)}</ul>}</div>
        <p className="text-xs text-ink/55">{provider.emailConfigured ? "Email delivery is configured and will be sent through the selected provider." : "Email delivery is not configured. Sending will fail until an email provider is configured in Site Settings."}</p>
      </div> : <div className="mt-5 grid gap-4">
        <label className="grid gap-1 text-sm font-semibold">Text message<div className="mb-1 flex items-center"><select aria-label="Insert merge tag into SMS" defaultValue="" onMouseDown={() => { const textarea = smsInputRef.current; if (textarea) smsSelectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd }; }} onChange={(event) => { const tag = event.target.value as typeof MERGE_TAGS[number]["value"]; if (tag) insertSmsMergeTag(tag); event.currentTarget.value = ""; }} className="focus-ring rounded-md border border-ink/10 bg-white px-2 py-1 text-xs"><option value="" disabled>Insert merge tag</option>{MERGE_TAGS.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}</select></div><textarea ref={smsInputRef} value={smsBody} maxLength={1600} onSelect={(event) => { smsSelectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={(event) => setSmsBody(event.target.value)} rows={10} className={`${inputClass} resize-y`} placeholder="Write a concise message for opted-in members." /></label>
        <div className="flex justify-between text-xs text-ink/55"><span>SMS messages are limited to 1,600 characters.</span><span>{smsBody.length}/1600</span></div>
        <p className="text-xs text-ink/55">{provider.smsConfigured ? "SMS delivery is configured and will be sent through the selected provider." : "SMS delivery is not configured. Sending will fail until an SMS provider is configured in Site Settings."}</p>
      </div>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5"><span className="text-sm text-ink/60">{sentChannels.length ? `${sentChannels.map((sentChannel) => sentChannel === "EMAIL" ? "Email" : "SMS").join(" and ")} already sent. Draft retained.` : `Only ${eligible.length} opted-in recipient${eligible.length === 1 ? "" : "s"} will be included.`}</span><div className="flex flex-wrap gap-2"><button type="button" disabled={submitting || !eligible.length || sentChannels.includes(channel)} className="focus-ring rounded-full border border-ink/20 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void submitMessage()}>{submitting ? "Sending…" : sentChannels.includes(channel) ? `${channel === "EMAIL" ? "Email" : "SMS"} sent` : `Send ${channel === "EMAIL" ? "email" : "SMS"}`}</button><button type="button" disabled={submitting || (!emailEligible.length && !smsEligible.length) || (sentChannels.includes("EMAIL") && sentChannels.includes("SMS"))} className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d95f43] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void submitBothMessages()}>{submitting ? "Sending…" : sentChannels.includes("EMAIL") && sentChannels.includes("SMS") ? "Email + SMS sent" : "Send email + SMS"}</button></div></div>
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-7 xl:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Message history</h2><p className="mt-1 text-sm text-ink/60">Recent sends and recipient-level delivery attempts are retained for follow-up.</p></div><a href="/admin/site-settings/messaging" className="text-sm font-semibold text-coral">Messaging settings</a></div>
      <div className="mt-5 grid gap-3">{history.map((message) => {
        const failed = message.recipients.filter((recipient) => recipient.status === "FAILED");
        return <div key={message.id} className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{message.channel === "EMAIL" ? "Email" : "SMS"}{message.subject ? ` · ${message.subject}` : ""}</p><p className="mt-1 text-xs text-ink/55">{new Date(message.createdAt).toLocaleString()} · {message.createdBy.name} · {message.recipients.length} recipient{message.recipients.length === 1 ? "" : "s"}</p></div><span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{message.status}</span></div><p className="mt-2 text-sm text-ink/65">{message.deliveryNote ?? "No delivery note."}</p>{failed.length > 0 && <><div className="mt-3 grid gap-2 text-xs text-coral">{failed.slice(0, 8).map((recipient) => <div key={recipient.id} className="flex flex-wrap justify-between gap-2"><span>{recipient.displayName} · {recipient.address}</span><span>{recipient.failureReason ?? "Delivery failed"} · {recipient.attemptCount} attempt{recipient.attemptCount === 1 ? "" : "s"}</span></div>)}</div><button type="button" disabled={retrying === message.id} onClick={() => void retryFailed(message.id)} className="focus-ring mt-3 rounded-full border border-coral px-4 py-2 text-xs font-semibold text-coral disabled:opacity-50">{retrying === message.id ? "Retrying…" : `Retry ${failed.length} failed recipient${failed.length === 1 ? "" : "s"}`}</button></>}</div>;
      })}{!history.length && <p className="text-sm text-ink/55">No messages have been sent yet.</p>}</div>
    </section>
  </div>;
}
