import { sanitizeAnnouncementHtml } from "@/lib/announcement-content";

export const ANNOUNCEMENT_DOCUMENT_VERSION = 1;
export const ANNOUNCEMENT_CANVAS_WIDTH = 900;
export const ANNOUNCEMENT_CANVAS_HEIGHT = 1200;

export type AnnouncementElement =
  | { id: string; type: "text"; x: number; y: number; width: number; height: number; text: string; fontSize: number; fontFamily: string; fill: string; align: "left" | "center" | "right"; fontStyle?: "normal" | "bold" | "italic"; underline?: boolean; link?: string; shadow?: { color: string; blur: number; offsetX: number; offsetY: number }; stroke?: string; strokeWidth?: number }
  | { id: string; type: "rect"; x: number; y: number; width: number; height: number; fill: string; cornerRadius: number; shape?: "rect" | "circle" | "triangle" | "star"; stroke?: string; strokeWidth?: number }
  | { id: string; type: "image"; x: number; y: number; width: number; height: number; src: string; alt: string; cornerRadius: number };

export type AnnouncementPage = {
  id: string;
  width: number;
  height: number;
  background: string;
  elements: AnnouncementElement[];
};

export type AnnouncementDocument = {
  version: 1;
  width: number;
  height: number;
  background: string;
  elements: AnnouncementElement[];
  pages?: AnnouncementPage[];
};

export function centeredAnnouncementPosition(pageWidth: number, pageHeight: number, elementWidth: number, elementHeight: number, margin = 24) {
  return {
    x: Math.max(margin, (pageWidth - elementWidth) / 2),
    y: Math.max(margin, (pageHeight - elementHeight) / 2),
  };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function safeId(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : fallback;
}

export function defaultAnnouncementDocument(title = ""): AnnouncementDocument {
  return {
    version: ANNOUNCEMENT_DOCUMENT_VERSION,
    width: ANNOUNCEMENT_CANVAS_WIDTH,
    height: ANNOUNCEMENT_CANVAS_HEIGHT,
    background: "#fffaf2",
    elements: [
      { id: "title", type: "text", x: 70, y: 70, width: 760, height: 90, text: title || "Weekly news", fontSize: 52, fontFamily: "Georgia", fill: "#17324d", align: "center", fontStyle: "bold" },
      { id: "rule", type: "rect", x: 120, y: 185, width: 660, height: 6, fill: "#e66f51", cornerRadius: 3 },
      { id: "body", type: "text", x: 90, y: 245, width: 720, height: 250, text: "Add your announcement content here.", fontSize: 24, fontFamily: "Arial", fill: "#17324d", align: "left" }
    ]
  };
}

export function parseAnnouncementDocument(value: unknown): AnnouncementDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== ANNOUNCEMENT_DOCUMENT_VERSION || !Array.isArray(source.elements)) return null;
  const elements: AnnouncementElement[] = [];
  source.elements.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;
    const item = candidate as Record<string, unknown>;
    const type = item.type;
    const base = {
      id: safeId(item.id, `element-${index + 1}`),
      x: boundedNumber(item.x, 0, -2000, 4000),
      y: boundedNumber(item.y, 0, -2000, 4000),
      width: boundedNumber(item.width, 100, 1, 4000),
      height: boundedNumber(item.height, 60, 1, 4000)
    };
    if (type === "text" && typeof item.text === "string") {
      elements.push({ ...base, type, text: item.text.slice(0, 5000), fontSize: boundedNumber(item.fontSize, 24, 8, 180), fontFamily: typeof item.fontFamily === "string" ? item.fontFamily.slice(0, 80) : "Arial", fill: typeof item.fill === "string" ? item.fill.slice(0, 40) : "#17324d", align: item.align === "center" || item.align === "right" ? item.align : "left", fontStyle: item.fontStyle === "bold" || item.fontStyle === "italic" ? item.fontStyle : "normal", underline: item.underline === true, link: typeof item.link === "string" && /^https?:\/\//i.test(item.link) ? item.link.slice(0, 500) : undefined, shadow: item.shadow && typeof item.shadow === "object" ? { color: typeof (item.shadow as Record<string, unknown>).color === "string" ? String((item.shadow as Record<string, unknown>).color).slice(0, 40) : "#00000066", blur: boundedNumber((item.shadow as Record<string, unknown>).blur, 0, 0, 80), offsetX: boundedNumber((item.shadow as Record<string, unknown>).offsetX, 0, -100, 100), offsetY: boundedNumber((item.shadow as Record<string, unknown>).offsetY, 0, -100, 100) } : undefined, stroke: typeof item.stroke === "string" ? item.stroke.slice(0, 40) : undefined, strokeWidth: boundedNumber(item.strokeWidth, 0, 0, 20) });
    } else if (type === "rect") {
      elements.push({ ...base, type, fill: typeof item.fill === "string" ? item.fill.slice(0, 40) : "#e66f51", cornerRadius: boundedNumber(item.cornerRadius, 0, 0, 200), shape: item.shape === "circle" || item.shape === "triangle" || item.shape === "star" ? item.shape : "rect", stroke: typeof item.stroke === "string" ? item.stroke.slice(0, 40) : undefined, strokeWidth: boundedNumber(item.strokeWidth, 0, 0, 50) });
    } else if (type === "image" && typeof item.src === "string" && /^(https?:\/\/|\/)/i.test(item.src)) {
      elements.push({ ...base, type, src: item.src.slice(0, 2000), alt: typeof item.alt === "string" ? item.alt.slice(0, 300) : "", cornerRadius: boundedNumber(item.cornerRadius, 0, 0, 200) });
    }
  });
  const width = boundedNumber(source.width, ANNOUNCEMENT_CANVAS_WIDTH, 320, 2000);
  const height = boundedNumber(source.height, ANNOUNCEMENT_CANVAS_HEIGHT, 320, 3000);
  return { version: 1, width, height, background: typeof source.background === "string" ? source.background.slice(0, 40) : "#fffaf2", elements, pages: Array.isArray(source.pages) ? source.pages.flatMap((page, index) => {
    const parsed = parseAnnouncementDocument({ version: 1, width: (page as Record<string, unknown>)?.width, height: (page as Record<string, unknown>)?.height, background: (page as Record<string, unknown>)?.background, elements: (page as Record<string, unknown>)?.elements });
    return parsed ? [{ id: safeId((page as Record<string, unknown>)?.id, `page-${index + 1}`), width: parsed.width, height: parsed.height, background: parsed.background, elements: parsed.elements }] : [];
  }) : undefined };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function announcementDocumentToHtml(document: AnnouncementDocument): string {
  if (document.pages?.length) {
    return document.pages.map((page) => announcementDocumentToHtml({ ...document, pages: undefined, width: page.width, height: page.height, background: page.background, elements: page.elements })).join('<div style="page-break-after:always"></div>');
  }
  const elements = document.elements.map((element) => {
    const style = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;`;
    if (element.type === "text") {
      const text = `<div style="${style}font-size:${element.fontSize}px;font-family:${escapeHtml(element.fontFamily)};color:${escapeHtml(element.fill)};text-align:${element.align};font-weight:${element.fontStyle === "bold" ? "700" : "400"};font-style:${element.fontStyle === "italic" ? "italic" : "normal"};text-decoration:${element.underline ? "underline" : "none"};text-shadow:${element.shadow ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${escapeHtml(element.shadow.color)}` : "none"};-webkit-text-stroke:${element.strokeWidth ?? 0}px ${escapeHtml(element.stroke ?? "transparent")};white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(element.text)}</div>`;
      return element.link ? `<a href="${escapeHtml(element.link)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
    }
    if (element.type === "image") return `<img src="${escapeHtml(element.src)}" alt="${escapeHtml(element.alt)}" style="${style}object-fit:cover;border-radius:${element.cornerRadius}px">`;
    const shapeStyle = element.shape === "circle" ? "border-radius:50%;" : element.shape === "triangle" ? `clip-path:polygon(50% 0%, 100% 100%, 0% 100%);` : element.shape === "star" ? "clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 100%, 50% 73%, 21% 100%, 32% 57%, 2% 35%, 39% 35%);" : `border-radius:${element.cornerRadius}px;`;
    return `<div aria-hidden="true" style="${style}background:${escapeHtml(element.fill)};${shapeStyle}${element.stroke ? `border:${element.strokeWidth ?? 1}px solid ${escapeHtml(element.stroke)};` : ""}"></div>`;
  }).join("");
  return `<div class="announcement-document" style="position:relative;width:${document.width}px;max-width:100%;min-height:${document.height}px;background:${escapeHtml(document.background)};overflow:hidden">${elements}</div>`;
}

export function legacyHtmlToAnnouncementDocument(title: string, bodyHtml: string) {
  const document = defaultAnnouncementDocument(title);
  const text = sanitizeAnnouncementHtml(bodyHtml).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
  const body = document.elements.find((element) => element.id === "body");
  if (body?.type === "text") body.text = text || body.text;
  return document;
}

export function parseOrMigrateAnnouncementDocument(value: unknown, title: string, bodyHtml: string) {
  return parseAnnouncementDocument(value) ?? legacyHtmlToAnnouncementDocument(title, bodyHtml);
}
