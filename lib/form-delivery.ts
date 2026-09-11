import PDFDocument from "pdfkit";
import { sendMembershipEmail, type EmailAttachment } from "@/lib/membership-delivery";
import type { FormDefinition } from "@/lib/form-config";

export type SubmissionValues = Record<string, unknown>;

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === undefined || value === null ? "" : String(value);
}

function replaceShortcodes(value: string, values: SubmissionValues) {
  return value.replace(/\{([A-Za-z][A-Za-z0-9_-]{0,63})\}/g, (_match, name: string) => displayValue(values[name]));
}

function plainTextBody(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\r\n").replace(/<\/(p|div|li)>/gi, "\r\n").replace(/<[^>]+>/g, "").replace(/\r\n{3,}/g, "\r\n\r\n").trim();
}

export function submissionPdf(formName: string, definition: FormDefinition, values: SubmissionValues, submittedAt: Date) {
  const exportSettings = definition.exportSettings;
  const title = exportSettings.pdfTitle || formName;
  const document = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const result = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document.fontSize(20).fillColor(exportSettings.pdfAccentColor).text(title, { underline: true });
  document.moveDown(0.5).fontSize(10).fillColor("#666666").text(`Submitted ${submittedAt.toISOString()}`);
  document.moveDown().fillColor("#000000");
  const allFields = definition.steps.flatMap((step) => step.fields).filter((field) => exportSettings.includeHiddenFields || field.settings?.conditional !== true);
  const orderedNames = exportSettings.fieldOrder;
  const fields = orderedNames.length ? [...orderedNames.map((name) => allFields.find((field) => field.name === name)).filter((field): field is FormDefinition["steps"][number]["fields"][number] => Boolean(field)), ...allFields.filter((field) => !orderedNames.includes(field.name))] : allFields;
  for (const field of fields) {
    if (["section-break", "button", "custom-html"].includes(field.type)) continue;
    document.fontSize(10).fillColor("#555555").text(field.label);
    document.fontSize(12).fillColor("#000000").text(displayValue(values[field.name]) || "—");
    document.moveDown(0.65);
  }
  document.end();
  return result;
}

export async function emailSubmissionPdf(options: { to: string[]; subject: string; body?: string; format?: "html" | "text"; formName: string; definition: FormDefinition; values: SubmissionValues; submittedAt: Date; attachPdf?: boolean; attachmentUrl?: string; attachmentName?: string; uploadedAttachments?: { fileName: string; contentType: string; content: Buffer }[]; fromName?: string; fromEmail?: string; replyTo?: string; bcc?: string[]; cc?: string[] }) {
  const attachments: EmailAttachment[] = [];
  if (options.attachPdf !== false) {
    const pdf = await submissionPdf(options.formName, options.definition, options.values, options.submittedAt);
    attachments.push({
      fileName: `${options.formName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "form"}-submission.pdf`,
      contentBase64: `data:application/pdf;base64,${pdf.toString("base64")}`,
      contentType: "application/pdf"
    });
  }
  if (options.attachmentUrl) {
    const attachmentUrl = new URL(options.attachmentUrl, process.env.NEXTAUTH_URL ?? "http://localhost:3000");
    const attachmentResponse = await fetch(attachmentUrl);
    if (!attachmentResponse.ok) throw new Error("The configured notification attachment could not be loaded.");
    const attachment = Buffer.from(await attachmentResponse.arrayBuffer());
    const fallbackName = attachmentUrl.searchParams.get("file") || attachmentUrl.pathname.split("/").pop() || "attachment";
    attachments.push({
      fileName: options.attachmentName || fallbackName,
      contentBase64: `data:${attachmentResponse.headers.get("content-type") || "application/octet-stream"};base64,${attachment.toString("base64")}`,
      contentType: attachmentResponse.headers.get("content-type") || "application/octet-stream"
    });
  }
  for (const uploaded of options.uploadedAttachments ?? []) {
    attachments.push({
      fileName: uploaded.fileName,
      contentBase64: `data:${uploaded.contentType || "application/octet-stream"};base64,${uploaded.content.toString("base64")}`,
      contentType: uploaded.contentType || "application/octet-stream"
    });
  }
  const bodyText = plainTextBody(options.body || `A new ${options.formName} submission was received.`);
  const bodyHtml = options.format === "text" ? `<p>${bodyText}</p>` : options.body || `<p>A new ${options.formName} submission was received.</p>`;
  for (const recipient of options.to) {
    await sendMembershipEmail({
      recipient,
      subject: options.subject,
      bodyHtml,
      bodyText,
      attachments,
      fromName: options.fromName,
      fromEmail: options.fromEmail,
      replyTo: options.replyTo,
      bcc: options.bcc,
      cc: options.cc
    });
  }
}

export { displayValue, replaceShortcodes };
