import { sanitizeAnnouncementHtml } from "@/lib/announcement-content";

export const ANNOUNCEMENT_DOCUMENT_VERSION = 1;
export const ANNOUNCEMENT_CANVAS_WIDTH = 900;
export const ANNOUNCEMENT_CANVAS_HEIGHT = 1200;

export type AnnouncementShape =
  | "rect"
  | "circle"
  | "triangle"
  | "star"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "arrowRight"
  | "arrowLeft"
  | "arrowUp"
  | "arrowDown"
  | "chevron"
  | "speechBubble"
  | "heart"
  | "cloud"
  | "plus"
  | "flowchartProcess"
  | "flowchartDecision"
  | "banner"
  | "ribbon";

export const ANNOUNCEMENT_SHAPES: { value: AnnouncementShape; label: string; icon: string }[] = [
  { value: "rect", label: "Square", icon: "■" },
  { value: "rect", label: "Rounded", icon: "▣" },
  { value: "circle", label: "Circle", icon: "●" },
  { value: "triangle", label: "Triangle", icon: "▲" },
  { value: "star", label: "Star", icon: "★" },
  { value: "diamond", label: "Diamond", icon: "◆" },
  { value: "pentagon", label: "Pentagon", icon: "⬟" },
  { value: "hexagon", label: "Hexagon", icon: "⬢" },
  { value: "octagon", label: "Octagon", icon: "🛑" },
  { value: "arrowRight", label: "Arrow right", icon: "➜" },
  { value: "arrowLeft", label: "Arrow left", icon: "←" },
  { value: "arrowUp", label: "Arrow up", icon: "↑" },
  { value: "arrowDown", label: "Arrow down", icon: "↓" },
  { value: "chevron", label: "Chevron", icon: "❯" },
  { value: "speechBubble", label: "Speech bubble", icon: "▱" },
  { value: "heart", label: "Heart", icon: "♥" },
  { value: "cloud", label: "Cloud", icon: "☁" },
  { value: "plus", label: "Plus", icon: "+" },
  { value: "flowchartProcess", label: "Process", icon: "▭" },
  { value: "flowchartDecision", label: "Decision", icon: "◇" },
  { value: "banner", label: "Banner", icon: "▰" },
  { value: "ribbon", label: "Ribbon", icon: "🎗" }
];

const SHAPE_POINTS: Partial<Record<AnnouncementShape, [number, number][]>> = {
  triangle: [[50, 0], [100, 100], [0, 100]],
  star: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 100], [50, 73], [21, 100], [32, 57], [2, 35], [39, 35]],
  diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
  pentagon: [[50, 0], [100, 38], [81, 100], [19, 100], [0, 38]],
  hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
  octagon: [[29, 0], [71, 0], [100, 29], [100, 71], [71, 100], [29, 100], [0, 71], [0, 29]],
  arrowRight: [[0, 30], [58, 30], [58, 5], [100, 50], [58, 95], [58, 70], [0, 70]],
  arrowLeft: [[42, 30], [100, 30], [100, 70], [42, 70], [42, 95], [0, 50], [42, 5]],
  arrowUp: [[30, 42], [30, 100], [70, 100], [70, 42], [95, 42], [50, 0], [5, 42]],
  arrowDown: [[30, 0], [70, 0], [70, 58], [95, 58], [50, 100], [5, 58], [30, 58]],
  chevron: [[0, 0], [25, 0], [75, 50], [25, 100], [0, 100], [50, 50]],
  speechBubble: [[0, 0], [100, 0], [100, 72], [65, 72], [48, 100], [48, 72], [0, 72]],
  heart: [[50, 92], [7, 42], [5, 25], [15, 8], [31, 5], [50, 22], [69, 5], [85, 8], [95, 25], [93, 42]],
  cloud: [[18, 72], [5, 59], [8, 39], [25, 31], [31, 12], [49, 3], [67, 12], [73, 28], [91, 29], [100, 45], [94, 63], [79, 72]],
  plus: [[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]],
  flowchartProcess: [[12, 0], [88, 0], [100, 12], [100, 88], [88, 100], [12, 100], [0, 88], [0, 12]],
  flowchartDecision: [[50, 0], [100, 50], [50, 100], [0, 50]],
  banner: [[0, 12], [15, 12], [15, 0], [85, 0], [85, 12], [100, 12], [88, 50], [100, 88], [85, 88], [85, 100], [15, 100], [15, 88], [0, 88], [12, 50]],
  ribbon: [[0, 12], [75, 12], [100, 0], [88, 50], [100, 100], [75, 88], [0, 88], [12, 50]]
};

export function announcementShapePoints(shape: AnnouncementShape) {
  return SHAPE_POINTS[shape] ?? [];
}

export function announcementShapeClipPath(shape: AnnouncementShape) {
  const points = announcementShapePoints(shape);
  return points.length ? `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(",")})` : undefined;
}

export type AnnouncementElement =
  | { id: string; type: "text"; x: number; y: number; width: number; height: number; text: string; fontSize: number; fontFamily: string; fill: string; align: "left" | "center" | "right"; fontStyle?: "normal" | "bold" | "italic"; underline?: boolean; link?: string; shadow?: { color: string; blur: number; offsetX: number; offsetY: number }; stroke?: string; strokeWidth?: number; container?: "table" | "grid"; cellId?: string; layoutId?: string; layoutType?: "table" | "grid"; layoutGap?: number; layoutRows?: number; layoutColumns?: number; cellRow?: number; cellColumn?: number }
  | { id: string; type: "rect"; x: number; y: number; width: number; height: number; fill: string; cornerRadius: number; shape?: AnnouncementShape; stroke?: string; strokeWidth?: number; container?: "table" | "grid"; cellId?: string; layoutId?: string; layoutType?: "table" | "grid"; layoutGap?: number; layoutRows?: number; layoutColumns?: number; cellRow?: number; cellColumn?: number }
  | { id: string; type: "image"; x: number; y: number; width: number; height: number; src: string; alt: string; cornerRadius: number; container?: "table" | "grid"; cellId?: string; layoutId?: string; layoutType?: "table" | "grid"; layoutGap?: number; layoutRows?: number; layoutColumns?: number; cellRow?: number; cellColumn?: number };

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

export function announcementCanvasDropPoint(clientX: number, clientY: number, canvasBounds: { left: number; top: number }, zoom: number) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { x: (clientX - canvasBounds.left) / safeZoom, y: (clientY - canvasBounds.top) / safeZoom };
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
    elements: []
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
      elements.push({ ...base, type, text: item.text.slice(0, 5000), fontSize: boundedNumber(item.fontSize, 24, 8, 180), fontFamily: typeof item.fontFamily === "string" ? item.fontFamily.slice(0, 80) : "Arial", fill: typeof item.fill === "string" ? item.fill.slice(0, 40) : "#17324d", align: item.align === "center" || item.align === "right" ? item.align : "left", fontStyle: item.fontStyle === "bold" || item.fontStyle === "italic" ? item.fontStyle : "normal", underline: item.underline === true, link: typeof item.link === "string" && /^https?:\/\//i.test(item.link) ? item.link.slice(0, 500) : undefined, shadow: item.shadow && typeof item.shadow === "object" ? { color: typeof (item.shadow as Record<string, unknown>).color === "string" ? String((item.shadow as Record<string, unknown>).color).slice(0, 40) : "#00000066", blur: boundedNumber((item.shadow as Record<string, unknown>).blur, 0, 0, 80), offsetX: boundedNumber((item.shadow as Record<string, unknown>).offsetX, 0, -100, 100), offsetY: boundedNumber((item.shadow as Record<string, unknown>).offsetY, 0, -100, 100) } : undefined, stroke: typeof item.stroke === "string" ? item.stroke.slice(0, 40) : undefined, strokeWidth: boundedNumber(item.strokeWidth, 0, 0, 20), container: item.container === "table" || item.container === "grid" ? item.container : undefined, cellId: typeof item.cellId === "string" ? item.cellId.slice(0, 100) : undefined, layoutId: typeof item.layoutId === "string" ? item.layoutId.slice(0, 100) : undefined, layoutType: item.layoutType === "table" || item.layoutType === "grid" ? item.layoutType : undefined, layoutGap: boundedNumber(item.layoutGap, 0, 0, 200), layoutRows: boundedNumber(item.layoutRows, 0, 0, 100), layoutColumns: boundedNumber(item.layoutColumns, 0, 0, 100), cellRow: boundedNumber(item.cellRow, 0, 0, 100), cellColumn: boundedNumber(item.cellColumn, 0, 0, 100) });
    } else if (type === "rect") {
      const shape = ANNOUNCEMENT_SHAPES.some((candidate) => candidate.value === item.shape) ? item.shape as AnnouncementShape : "rect";
      elements.push({ ...base, type, fill: typeof item.fill === "string" ? item.fill.slice(0, 40) : "#e66f51", cornerRadius: boundedNumber(item.cornerRadius, 0, 0, 200), shape, stroke: typeof item.stroke === "string" ? item.stroke.slice(0, 40) : undefined, strokeWidth: boundedNumber(item.strokeWidth, 0, 0, 50), container: item.container === "table" || item.container === "grid" ? item.container : undefined, cellId: typeof item.cellId === "string" ? item.cellId.slice(0, 100) : undefined, layoutId: typeof item.layoutId === "string" ? item.layoutId.slice(0, 100) : undefined, layoutType: item.layoutType === "table" || item.layoutType === "grid" ? item.layoutType : undefined, layoutGap: boundedNumber(item.layoutGap, 0, 0, 200), layoutRows: boundedNumber(item.layoutRows, 0, 0, 100), layoutColumns: boundedNumber(item.layoutColumns, 0, 0, 100), cellRow: boundedNumber(item.cellRow, 0, 0, 100), cellColumn: boundedNumber(item.cellColumn, 0, 0, 100) });
    } else if (type === "image" && typeof item.src === "string" && /^(https?:\/\/|\/)/i.test(item.src)) {
      elements.push({ ...base, type, src: item.src.slice(0, 2000), alt: typeof item.alt === "string" ? item.alt.slice(0, 300) : "", cornerRadius: boundedNumber(item.cornerRadius, 0, 0, 200), container: item.container === "table" || item.container === "grid" ? item.container : undefined, cellId: typeof item.cellId === "string" ? item.cellId.slice(0, 100) : undefined, layoutId: typeof item.layoutId === "string" ? item.layoutId.slice(0, 100) : undefined, layoutType: item.layoutType === "table" || item.layoutType === "grid" ? item.layoutType : undefined, layoutGap: boundedNumber(item.layoutGap, 0, 0, 200), layoutRows: boundedNumber(item.layoutRows, 0, 0, 100), layoutColumns: boundedNumber(item.layoutColumns, 0, 0, 100), cellRow: boundedNumber(item.cellRow, 0, 0, 100), cellColumn: boundedNumber(item.cellColumn, 0, 0, 100) });
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
    const shapeStyle = element.shape === "circle" ? "border-radius:50%;" : announcementShapeClipPath(element.shape ?? "rect") ? `clip-path:${announcementShapeClipPath(element.shape ?? "rect")};` : `border-radius:${element.cornerRadius}px;`;
    return `<div aria-hidden="true" style="${style}background:${escapeHtml(element.fill)};${shapeStyle}${element.stroke ? `border:${element.strokeWidth ?? 1}px solid ${escapeHtml(element.stroke)};` : ""}"></div>`;
  }).join("");
  return `<div class="announcement-document" style="position:relative;width:${document.width}px;max-width:100%;min-height:${document.height}px;background:${escapeHtml(document.background)};overflow:hidden">${elements}</div>`;
}

export function legacyHtmlToAnnouncementDocument(title: string, bodyHtml: string) {
  const document = defaultAnnouncementDocument(title);
  const text = sanitizeAnnouncementHtml(bodyHtml).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
  document.elements = [{ id: "body", type: "text", x: 90, y: 90, width: 720, height: 250, text: text || title || "Announcement", fontSize: 24, fontFamily: "Arial", fill: "#17324d", align: "left" }];
  return document;
}

export function parseOrMigrateAnnouncementDocument(value: unknown, title: string, bodyHtml: string) {
  return parseAnnouncementDocument(value) ?? legacyHtmlToAnnouncementDocument(title, bodyHtml);
}
