export const BUILT_IN_MESSAGE_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome and connection",
    subject: "A note from St. Paul's",
    bodyHtml: "<p>Dear {{firstName}},</p><p>We wanted to share a quick note from St. Paul's. We hope you are doing well and look forward to seeing you soon.</p><p>With gratitude,<br>St. Paul's Church</p>",
    bodyText: "Dear {{firstName}},\n\nWe wanted to share a quick note from St. Paul's. We hope you are doing well and look forward to seeing you soon.\n\nWith gratitude,\nSt. Paul's Church"
  },
  {
    id: "announcement",
    name: "Church announcement",
    subject: "An update from St. Paul's",
    bodyHtml: "<p>Dear {{firstName}},</p><p>Here is an important update from our church community:</p><p><strong>Add your announcement here.</strong></p><p>Thank you,<br>St. Paul's Church</p>",
    bodyText: "Dear {{firstName}},\n\nHere is an important update from our church community:\n\nAdd your announcement here.\n\nThank you,\nSt. Paul's Church"
  },
  {
    id: "pastoral",
    name: "Pastoral care check-in",
    subject: "Checking in from St. Paul's",
    bodyHtml: "<p>Dear {{firstName}},</p><p>We are thinking of you and wanted to check in. Please reply if there is a way we can support you.</p><p>Peace,<br>St. Paul's Church</p>",
    bodyText: "Dear {{firstName}},\n\nWe are thinking of you and wanted to check in. Please reply if there is a way we can support you.\n\nPeace,\nSt. Paul's Church"
  }
] as const;

export const EMAIL_SAFE_FONTS = [
  { label: "Arial", value: "Arial" },
  { label: "Helvetica", value: "Helvetica" },
  { label: "Georgia", value: "Georgia" },
  { label: "Verdana", value: "Verdana" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "Trebuchet MS", value: "Trebuchet MS" }
] as const;

export const MERGE_TAGS = [
  { label: "First Name", value: "firstName" },
  { label: "Last Name", value: "lastName" },
  { label: "Family Name", value: "familyName" },
  { label: "Formal Greeting", value: "formalGreeting" },
  { label: "Informal Greeting", value: "informalGreeting" },
  { label: "City", value: "city" },
  { label: "Church Name", value: "churchName" },
  { label: "Current Year", value: "currentYear" }
] as const;

export const EMAIL_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp"
]);

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeEmailHtml(input: string) {
  let html = input.slice(0, 500_000);
  html = html.replace(/<(script|style|iframe|object|embed|form|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, "");
  html = html.replace(/<(script|style|iframe|object|embed|form|meta|link)[^>]*\/?>/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
  html = html.replace(/\s+(href|src)\s*=\s*(['"])\s*(data:(?!image\/(?:png|jpe?g|gif|webp);base64,)|vbscript:)[\s\S]*?\2/gi, "");
  html = html.replace(/\s+(href|src)\s*=\s*(?:javascript:|vbscript:|data:(?!image\/(?:png|jpe?g|gif|webp);base64,))[^\s>]*/gi, "");
  html = html.replace(/\s+style\s*=\s*(['"])[\s\S]*?(?:expression\s*\(|javascript:|vbscript:|data:text\/html)[\s\S]*?\1/gi, "");
  return html.trim();
}

export function interpolateMessage(value: string, firstName: string, lastName = "", context: Partial<Record<typeof MERGE_TAGS[number]["value"], string>> = {}) {
  const values = { firstName, lastName, ...context };
  const normalizedValues = Object.fromEntries(Object.entries(values).map(([key, entry]) => [key.toLowerCase(), entry]));
  return value.replace(/\{\{\s*(firstName|lastName|familyName|formalGreeting|informalGreeting|city|churchName|currentYear)\s*\}\}/gi, (match, tag: string) => normalizedValues[tag.toLowerCase()] ?? match);
}
