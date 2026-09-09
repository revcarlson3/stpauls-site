import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPublicForm, listSubmissions } from "@/lib/forms";
import { normalizeFormDefinition, validateFormValues, type FormDefinition } from "@/lib/form-config";
import { emailSubmissionPdf, replaceShortcodes } from "@/lib/form-delivery";
import { requirePermission } from "@/lib/auth";

const attempts = new Map<string, { count: number; expiresAt: number }>();

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json(await listSubmissions(params.id)); } catch (error) { return unauthorized(error); }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const form = await db.form.findFirst({ where: { id: params.id, enabled: true, status: "PUBLISHED" }, select: { id: true, name: true, definition: true, notificationSettings: true, exportSettings: true } });
  if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const ipHash = crypto.createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? "form-rate-limit"}:${address}`).digest("hex");
  const key = `${params.id}:${ipHash}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.expiresAt > now && current.count >= 8) return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  if (attempts.size > 5000) attempts.forEach((entry, entryKey) => { if (entry.expiresAt <= now) attempts.delete(entryKey); });
  attempts.set(key, { count: current && current.expiresAt > now ? current.count + 1 : 1, expiresAt: now + 15 * 60 * 1000 });
  const uploadedFiles: { fieldName: string; file: File }[] = [];
  let payload: Record<string, unknown> | null = null;
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawPayload = formData.get("payload");
      payload = typeof rawPayload === "string" ? JSON.parse(rawPayload) as Record<string, unknown> : null;
      formData.forEach((value, key) => {
        if (key.startsWith("file:") && value instanceof File && value.size) uploadedFiles.push({ fieldName: key.slice(5), file: value });
      });
    } else {
      payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    }
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  if (payload._website) return NextResponse.json({ error: "Submission rejected." }, { status: 400 });
  const result = validateFormValues(form.definition, payload.values);
  if (!result.valid) return NextResponse.json({ error: result.definition.failureMessage, fields: result.errors }, { status: 422 });
  const uniqueFields = result.definition.steps.flatMap((step) => step.fields).filter((field) => field.settings?.isUnique === true);
  if (uniqueFields.length) {
    const previous = await db.formSubmission.findMany({ where: { formId: form.id }, select: { values: true } });
    const duplicateFields = uniqueFields.filter((field) => {
      const value = result.values[field.name];
      if (value === undefined || value === null || value === "") return false;
      return previous.some((submission) => {
        const values = submission.values && typeof submission.values === "object" && !Array.isArray(submission.values) ? submission.values as Record<string, unknown> : {};
        return String(values[field.name] ?? "").trim().toLowerCase() === String(value).trim().toLowerCase();
      });
    });
    if (duplicateFields.length) return NextResponse.json({ error: "Please correct the highlighted fields.", fields: Object.fromEntries(duplicateFields.map((field) => [field.name, "This value has already been submitted."])) }, { status: 422 });
  }
  const metadata = { submittedAt: new Date().toISOString(), referrer: typeof payload.referrer === "string" ? payload.referrer.slice(0, 500) : null };
  const submission = await db.formSubmission.create({ data: { formId: form.id, values: result.values as Prisma.InputJsonValue, metadata: metadata as Prisma.InputJsonValue, ipHash, userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null } });
  const notificationSettings = form.notificationSettings && typeof form.notificationSettings === "object" && !Array.isArray(form.notificationSettings) ? form.notificationSettings as Record<string, unknown> : {};
  const storedNotifications = Array.isArray(notificationSettings.notifications) ? notificationSettings.notifications : [notificationSettings];
  const fileFieldNames = new Set(collectFields(result.definition.steps.flatMap((step) => step.fields)).filter((field) => field.type === "file").map((field) => field.name));
  const uploadedAttachments = await Promise.all(uploadedFiles.filter(({ fieldName }) => fileFieldNames.has(fieldName)).map(async ({ fieldName, file }) => ({ fieldName, fileName: file.name.slice(0, 200) || "uploaded-file", contentType: file.type || "application/octet-stream", content: Buffer.from(await file.arrayBuffer()) })));
  const notificationFailures: string[] = [];
  for (const rawNotification of storedNotifications) {
      if (!rawNotification || typeof rawNotification !== "object" || Array.isArray(rawNotification)) continue;
      const notification = rawNotification as Record<string, unknown>;
      if (notification.enabled !== true) continue;
      const recipientMode = notification.recipientMode === "field" ? "field" : "email";
      const rawRecipients = recipientMode === "field" ? [result.values[String(notification.recipientField ?? "")]] : Array.isArray(notification.recipients) ? notification.recipients : [];
      const recipients = rawRecipients.flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())).map((value) => value.trim());
      if (!recipients.length) continue;
      const body = typeof notification.body === "string" ? replaceShortcodes(notification.body, result.values) : undefined;
      const deliveryDefinition = normalizeFormDefinition({ ...result.definition, exportSettings: form.exportSettings });
      try {
        await emailSubmissionPdf({ to: recipients, subject: typeof notification.subject === "string" && notification.subject ? replaceShortcodes(notification.subject, result.values) : `New ${form.name} submission`, body, format: notification.format === "text" ? "text" : "html", formName: form.name, definition: deliveryDefinition, values: result.values, submittedAt: submission.createdAt, attachPdf: notification.attachPdf !== false, attachmentUrl: typeof notification.attachmentUrl === "string" ? notification.attachmentUrl : undefined, attachmentName: typeof notification.attachmentName === "string" ? notification.attachmentName : undefined, uploadedAttachments: uploadedAttachments.filter((attachment) => fileFieldNames.has(attachment.fieldName)).map(({ fieldName: _fieldName, ...attachment }) => attachment), fromName: typeof notification.fromName === "string" ? notification.fromName : undefined, fromEmail: typeof notification.fromEmail === "string" ? notification.fromEmail : undefined, replyTo: typeof notification.replyTo === "string" ? notification.replyTo : undefined, bcc: parseAddresses(notification.bcc), cc: parseAddresses(notification.cc) });
      } catch (error) {
        const notificationId = typeof notification.id === "string" ? notification.id : "unnamed";
        notificationFailures.push(notificationId);
        console.error("Form submission notification failed", { formId: form.id, submissionId: submission.id, notificationId, recipientCount: recipients.length, error });
      }
    }
  if (notificationFailures.length) {
    return NextResponse.json({ id: submission.id, message: result.definition.confirmationMessage, warning: "Your submission was saved, but a notification email could not be delivered." }, { status: 201 });
  }
  return NextResponse.json({ id: submission.id, message: result.definition.confirmationMessage }, { status: 201 });
}

function parseAddresses(value: unknown) {
  return (Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : []).filter((item): item is string => typeof item === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.trim())).map((item) => item.trim());
}

function collectFields(fields: FormDefinition["steps"][number]["fields"]): FormDefinition["steps"][number]["fields"] {
  return fields.flatMap((field) => {
    const nestedItems = Array.isArray(field.settings?.items) ? field.settings.items.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && Array.isArray((item as { fields?: unknown }).fields) ? (item as { fields: FormDefinition["steps"][number]["fields"] }).fields : []) : [];
    const columns = Array.isArray(field.settings?.columnFields) ? field.settings.columnFields.flatMap((column) => Array.isArray(column) ? column as FormDefinition["steps"][number]["fields"] : []) : [];
    return [field, ...collectFields([...nestedItems, ...columns])];
  });
}

async function unauthorized(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try { await requirePermission("MANAGE_SETTINGS"); } catch { return NextResponse.json({ error: "Authentication required." }, { status: 401 }); }
  throw error;
}
