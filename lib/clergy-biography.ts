import { sanitizeRichTextHtml } from "@/lib/safe-html";

const FONT_SIZES: Record<string, string> = {
  "1": "0.75rem",
  "2": "0.875rem",
  "3": "1rem",
  "4": "1.125rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "7": "1.875rem",
};

export function sanitizeClergyBiographyHtml(value: string) {
  let html = sanitizeRichTextHtml(value || "")
    .replace(/<font\b[^>]*\bsize\s*=\s*["']([1-7])["'][^>]*>/gi, (_, size: string) => `<span style="font-size: ${FONT_SIZES[size]}">`)
    .replace(/<\/font>/gi, "</span>");

  html = html.replace(/<a\b[^>]*>/gi, (tag) => {
    const match = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i);
    const href = match?.[1] ?? "";
    return /^(https?:|mailto:)/i.test(href) ? `<a href="${href.replace(/"/g, "&quot;")}">` : "<a>";
  });
  html = html.replace(/<(strong|b|em|i|u|p|br)\b[^>]*>/gi, "<$1>");
  html = html.replace(/<span\b[^>]*style\s*=\s*["']font-size:\s*(0\.75|0\.875|1|1\.125|1\.25|1\.5|1\.875)rem["'][^>]*>/gi, (_, size: string) => `<span style="font-size: ${size}rem">`);
  html = html.replace(/<(?!\/?(?:strong|b|em|i|u|a|span|p|br)\b)[^>]+>/gi, "");
  html = html.replace(/<span\b(?! style="font-size: (?:0\.75|0\.875|1|1\.125|1\.25|1\.5|1\.875)rem")[^>]*>/gi, "");
  return html;
}
