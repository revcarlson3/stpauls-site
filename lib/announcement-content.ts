function safeHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "")
    .replace(/\s(src|href)\s*=\s*(['"])\s*data:[^'"]*\2/gi, "");
}

export function sanitizeAnnouncementHtml(value: string) {
  return safeHtml(value);
}

export function sanitizeTickerHtml(value: string) {
  return safeHtml(value)
    .replace(/<(img|video|audio|iframe|object|embed|svg|canvas|table|pre|ul|ol|li|blockquote)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(h[1-6]|p|div|section|article|header|footer|main|figure|figcaption|font|small|big|sub|sup)\b[^>]*>/gi, " ")
    .replace(/\s+(style|class|id|title|width|height|face|size)\s*=\s*(['"]).*?\2/gi, "")
    .replace(/<\/?(?!strong\b|b\b|em\b|i\b|a\b)[a-z][^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
