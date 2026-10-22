import { sanitizeAnnouncementHtml } from "@/lib/announcement-content";

export const ANNOUNCEMENT_DOCUMENT_VERSION = 1;
export const ANNOUNCEMENT_CANVAS_WIDTH = 900;
export const ANNOUNCEMENT_CANVAS_HEIGHT = 1200;

export type AnnouncementElement =
  | { id: string; type: "text"; x: number; y: number; width: number; height: number; text: string; fontSize: number; fontFamily: string; fill: string; align: "left" | "center" | "right"; fontStyle?: "normal" | "bold" | "italic" }
  | { id: string; type: "rect"; x: number; y: number; width: number; height: number; fill: string; cornerRadius: number; stroke?: string; strokeWidth?: number }
  | { id: string; type: "image"; x: number; y: number; width: number; height: number; src: string; alt: string; cornerRadius: number };

export type AnnouncementDocument = {
  version: 1;
  width: number;
  height: number;
  background: string;
  elements: AnnouncementElement[];
};

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
      elements.push({ ...base, type, text: item.text.slice(0, 5000), fontSize: boundedNumber(item.fontSize, 24, 8, 180), fontFamily: typeof item.fontFamily === "string" ? item.fontFamily.slice(0, 80) : "Arial", fill: typeof item.fill === "string" ? item.fill.slice(0, 40) : "#17324d", align: item.align === "center" || item.align === "right" ? item.align : "left", fontStyle: item.fontStyle === "bold" || item.fontStyle === "italic" ? item.fontStyle : "normal" });
    } else if (type === "rect") {
      elements.push({ ...base, type, fill: typeof item.fill === "string" ? item.fill.slice(0, 40) : "#e66f51", cornerRadius: boundedNumber(item.cornerRadius, 0, 0, 200), stroke: typeof item.stroke === "string" ? item.stroke.slice(0, 40) : undefined, strokeWidth: boundedNumber(item.strokeWidth, 0, 0, 50) });
    } else if (type === "image" && typeof item.src === "string" && /^(https?:\/\/|\/)/i.test(item.src)) {
      elements.push({ ...base, type, src: item.src.slice(0, 2000), alt: typeof item.alt === "string" ? item.alt.slice(0, 300) : "", cornerRadius: boundedNumber(item.cornerRadius, 0, 0, 200) });
    }
  });
  return { version: 1, width: boundedNumber(source.width, ANNOUNCEMENT_CANVAS_WIDTH, 320, 2000), height: boundedNumber(source.height, ANNOUNCEMENT_CANVAS_HEIGHT, 320, 3000), background: typeof source.background === "string" ? source.background.slice(0, 40) : "#fffaf2", elements };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function announcementDocumentToHtml(document: AnnouncementDocument) {
  const elements = document.elements.map((element) => {
    const style = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;`;
    if (element.type === "text") return `<div style="${style}font-size:${element.fontSize}px;font-family:${escapeHtml(element.fontFamily)};color:${escapeHtml(element.fill)};text-align:${element.align};font-weight:${element.fontStyle === "bold" ? "700" : "400"};font-style:${element.fontStyle === "italic" ? "italic" : "normal"};white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(element.text)}</div>`;
    if (element.type === "image") return `<img src="${escapeHtml(element.src)}" alt="${escapeHtml(element.alt)}" style="${style}object-fit:cover;border-radius:${element.cornerRadius}px">`;
    return `<div aria-hidden="true" style="${style}background:${escapeHtml(element.fill)};border-radius:${element.cornerRadius}px;${element.stroke ? `border:${element.strokeWidth ?? 1}px solid ${escapeHtml(element.stroke)};` : ""}"></div>`;
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
