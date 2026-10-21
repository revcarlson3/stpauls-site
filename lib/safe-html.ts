export function sanitizeRichTextHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(?:javascript|data):[^'"]*\2/gi, "");
}
