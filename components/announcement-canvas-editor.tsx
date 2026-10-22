"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, Circle, FabricImage, Line, Polygon, Rect, Shadow, Textbox, Triangle, type FabricObject } from "fabric";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui";
import { MediaPicker } from "@/components/media-picker";
import { announcementDocumentToHtml, defaultAnnouncementDocument, type AnnouncementDocument, type AnnouncementElement, type AnnouncementPage } from "@/lib/announcement-document";

type CanvasObject = FabricObject & {
  announcementId?: string;
  announcementType?: AnnouncementElement["type"];
  announcementAlt?: string;
  announcementCornerRadius?: number;
  announcementStroke?: string;
  announcementStrokeWidth?: number;
  announcementShape?: "rect" | "circle" | "triangle" | "star";
  announcementGuide?: boolean;
  announcementLink?: string;
};

type SelectedObject = {
  id: string;
  type: AnnouncementElement["type"];
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  fontStyle?: "normal" | "bold" | "italic";
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  link?: string;
  shadow?: boolean;
  stroke?: string;
  strokeWidth?: number;
  shape?: "rect" | "circle" | "triangle" | "star";
};

const COMMONLY_USED_FONTS = ["Arial", "Georgia", "Roboto", "Open Sans", "Montserrat", "Poppins"];
const COMMON_FONTS = ["Verdana", "Trebuchet MS", "Courier New", "Tahoma", "Times New Roman", "Impact", "Helvetica", "Garamond"];
const GOOGLE_FONTS = ["Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Merriweather", "Playfair Display", "Raleway", "Nunito", "Oswald", "Source Sans 3", "Libre Baskerville", "DM Sans", "Bebas Neue", "Inter", "Work Sans"];
const FONT_SIZES = Array.from({ length: 87 }, (_, index) => index + 8);
const PAGE_PRESETS = [
  { label: "Portrait (900 × 1200 px)", width: 900, height: 1200 },
  { label: "Square (1080 × 1080 px)", width: 1080, height: 1080 },
  { label: "Instagram portrait (1080 × 1350 px)", width: 1080, height: 1350 },
  { label: "Letter (8.5 × 11 in)", width: 816, height: 1056 },
  { label: "A4 (210 × 297 mm)", width: 794, height: 1123 },
  { label: "Landscape (1200 × 900 px)", width: 1200, height: 900 }
];

function pageList(document: AnnouncementDocument) {
  return document.pages?.length ? document.pages : [{ id: "page-1", width: document.width, height: document.height, background: document.background, elements: document.elements }];
}

function withPage(document: AnnouncementDocument, index: number, page: AnnouncementPage) {
  const pages = pageList(document).map((item, pageIndex) => pageIndex === index ? page : item);
  const first = pages[0] ?? page;
  return { ...document, width: first.width, height: first.height, background: first.background, elements: first.elements, pages };
}

function googleFontUrl(font: string) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}:wght@400;700&display=swap`;
}

function shapeObject(element: Extract<AnnouncementElement, { type: "rect" }>) {
  const common = { left: element.x, top: element.y, width: element.width, height: element.height, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth, transparentCorners: false, cornerColor: "#e66f51" };
  if (element.shape === "circle") return new Circle({ ...common, radius: Math.min(element.width, element.height) / 2, width: element.width, height: element.height });
  if (element.shape === "triangle") return new Triangle(common);
  if (element.shape === "star") return new Polygon([{ x: 50, y: 0 }, { x: 61, y: 35 }, { x: 98, y: 35 }, { x: 68, y: 57 }, { x: 79, y: 100 }, { x: 50, y: 73 }, { x: 21, y: 100 }, { x: 32, y: 57 }, { x: 2, y: 35 }, { x: 39, y: 35 }], { ...common, scaleX: element.width / 100, scaleY: element.height / 100 });
  return new Rect({ ...common, rx: element.cornerRadius, ry: element.cornerRadius });
}

function canvasObject(object: FabricObject) {
  return object as CanvasObject;
}

function numberValue(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? value as number : fallback;
}

function selectedObject(object: FabricObject | undefined): SelectedObject | null {
  if (!object) return null;
  const item = canvasObject(object);
  const id = item.announcementId;
  const type = item.announcementType;
  if (!id || !type) return null;
  const width = Math.max(1, object.getScaledWidth());
  const height = Math.max(1, object.getScaledHeight());
  const textObject = object as FabricObject & { text?: string; fontSize?: number; fontFamily?: string; textAlign?: "left" | "center" | "right"; fontStyle?: "normal" | "italic"; fontWeight?: string };
  return {
    id,
    type,
    text: textObject.text,
    fontSize: textObject.fontSize,
    fontFamily: textObject.fontFamily,
    fill: typeof object.fill === "string" ? object.fill : undefined,
    align: textObject.textAlign,
    fontStyle: textObject.fontWeight === "bold" ? "bold" : textObject.fontStyle === "italic" ? "italic" : "normal",
    opacity: numberValue(object.opacity, 1),
    x: numberValue(object.left, 0),
    y: numberValue(object.top, 0),
    width,
    height,
    link: (item as CanvasObject & { announcementLink?: string }).announcementLink,
    shadow: Boolean(object.shadow),
    stroke: typeof object.stroke === "string" ? object.stroke : undefined,
    strokeWidth: numberValue(object.strokeWidth, 0),
    shape: item.announcementShape
  };
}

function documentFromCanvas(canvas: Canvas, value: AnnouncementDocument): AnnouncementDocument {
  const elements: AnnouncementElement[] = canvas.getObjects().filter((object) => !canvasObject(object).announcementGuide).map((object) => {
    const item = canvasObject(object);
    const type = item.announcementType;
    const id = item.announcementId;
    const x = numberValue(object.left, 0);
    const y = numberValue(object.top, 0);
    const width = Math.max(1, object.getScaledWidth());
    const height = Math.max(1, object.getScaledHeight());
    if (type === "text" && id) {
      const textObject = object as FabricObject & { text?: string; fontSize?: number; fontFamily?: string; textAlign?: "left" | "center" | "right"; fontStyle?: "normal" | "italic"; fontWeight?: string };
      const shadow = object.shadow as { color?: string; blur?: number; offsetX?: number; offsetY?: number } | undefined;
      return { id, type, x, y, width, height, text: (textObject.text ?? "").slice(0, 5000), fontSize: numberValue(textObject.fontSize, 24), fontFamily: (textObject.fontFamily ?? "Arial").slice(0, 80), fill: typeof object.fill === "string" ? object.fill : "#17324d", align: textObject.textAlign ?? "left", fontStyle: textObject.fontWeight === "bold" ? "bold" : textObject.fontStyle === "italic" ? "italic" : "normal", link: (item as CanvasObject & { announcementLink?: string }).announcementLink, shadow: shadow ? { color: shadow.color ?? "#00000066", blur: shadow.blur ?? 0, offsetX: shadow.offsetX ?? 0, offsetY: shadow.offsetY ?? 0 } : undefined, stroke: typeof object.stroke === "string" ? object.stroke : undefined, strokeWidth: numberValue(object.strokeWidth, 0) };
    }
    if (type === "image" && id) {
      return { id, type, x, y, width, height, src: String((item as CanvasObject & { announcementSrc?: string }).announcementSrc ?? ""), alt: item.announcementAlt ?? "", cornerRadius: item.announcementCornerRadius ?? 0 };
    }
    return { id: id ?? `shape-${Date.now()}`, type: "rect", x, y, width, height, fill: typeof object.fill === "string" ? object.fill : "#e66f51", cornerRadius: item.announcementCornerRadius ?? 0, shape: item.announcementShape ?? "rect", stroke: item.announcementStroke, strokeWidth: item.announcementStrokeWidth };
  });
  return { ...value, background: typeof canvas.backgroundColor === "string" ? canvas.backgroundColor : value.background, elements };
}

function setCanvasObjectMetadata(object: FabricObject, element: AnnouncementElement) {
  const item = canvasObject(object);
  item.announcementId = element.id;
  item.announcementType = element.type;
  if (element.type === "text") {
    (item as CanvasObject & { announcementLink?: string }).announcementLink = element.link;
  }
  if (element.type === "image") {
    item.announcementAlt = element.alt;
    item.announcementCornerRadius = element.cornerRadius;
    (item as CanvasObject & { announcementSrc?: string }).announcementSrc = element.src;
  }
  if (element.type === "rect") {
    item.announcementShape = element.shape ?? "rect";
    item.announcementCornerRadius = element.cornerRadius;
    item.announcementStroke = element.stroke;
    item.announcementStrokeWidth = element.strokeWidth;
  }
}

export function AnnouncementCanvasEditor({ value, onChange }: { value: AnnouncementDocument; onChange: (value: AnnouncementDocument) => void }) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const loadingRef = useRef(false);
  const lastDocumentRef = useRef(JSON.stringify(value));
  const lastEmittedRef = useRef(JSON.stringify(value));
  const [selected, setSelected] = useState<SelectedObject | null>(null);
  const [history, setHistory] = useState<AnnouncementDocument[]>([]);
  const [future, setFuture] = useState<AnnouncementDocument[]>([]);
  const [zoom, setZoom] = useState(0.58);
  const [activePage, setActivePage] = useState(0);
  const [layers, setLayers] = useState<AnnouncementElement[]>(value.elements);
  const [fontQuery, setFontQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: AnnouncementElement["type"] } | null>(null);
  const pages = pageList(value);
  const currentPage = pages[activePage] ?? pages[0];

  const refreshSelection = useCallback(() => {
    const canvas = fabricRef.current;
    setSelected(selectedObject(canvas?.getActiveObject()));
    setLayers(canvas ? canvas.getObjects().map((object) => {
      const item = canvasObject(object);
      const element = currentPage.elements.find((candidate) => candidate.id === item.announcementId);
      return element ?? { id: item.announcementId ?? "unknown", type: item.announcementType ?? "rect", x: numberValue(object.left, 0), y: numberValue(object.top, 0), width: Math.max(1, object.getScaledWidth()), height: Math.max(1, object.getScaledHeight()), fill: "#e66f51", cornerRadius: 0 } as AnnouncementElement;
    }).reverse() : value.elements);
  }, [currentPage.elements]);

  const publish = useCallback((next: AnnouncementDocument, recordHistory = true) => {
    const serialized = JSON.stringify(next);
    if (serialized === lastEmittedRef.current) return;
    if (recordHistory) {
      const previous = JSON.parse(lastDocumentRef.current) as AnnouncementDocument;
      setHistory((items) => [...items.slice(-49), previous]);
      setFuture([]);
    }
    lastDocumentRef.current = serialized;
    lastEmittedRef.current = serialized;
    onChange(next);
  }, [onChange]);

  const syncFromCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || loadingRef.current) return;
    const nextPage = documentFromCanvas(canvas, { ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    publish(withPage(value, activePage, { ...currentPage, width: nextPage.width, height: nextPage.height, background: nextPage.background, elements: nextPage.elements }));
    refreshSelection();
  }, [activePage, currentPage, publish, refreshSelection, value]);

  const loadDocument = useCallback(async (document: AnnouncementDocument) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    loadingRef.current = true;
    canvas.clear();
    canvas.setDimensions({ width: document.width, height: document.height });
    canvas.backgroundColor = document.background;
    for (const element of document.elements) {
      if (element.type === "text") {
        const object = new Textbox(element.text, { left: element.x, top: element.y, width: element.width, fontSize: element.fontSize, fontFamily: element.fontFamily, fill: element.fill, textAlign: element.align, fontWeight: element.fontStyle === "bold" ? "bold" : "normal", fontStyle: element.fontStyle === "italic" ? "italic" : "normal", editable: true, transparentCorners: false, cornerColor: "#e66f51", stroke: element.stroke, strokeWidth: element.strokeWidth, shadow: element.shadow ? new Shadow({ color: element.shadow.color, blur: element.shadow.blur, offsetX: element.shadow.offsetX, offsetY: element.shadow.offsetY }) : undefined });
        object.set({ scaleY: element.height / Math.max(1, object.getScaledHeight()) });
        setCanvasObjectMetadata(object, element);
        canvas.add(object);
      } else if (element.type === "rect") {
        const object = shapeObject(element);
        setCanvasObjectMetadata(object, element);
        canvas.add(object);
      } else {
        try {
          const object = await FabricImage.fromURL(element.src, { crossOrigin: "anonymous" });
          object.set({ left: element.x, top: element.y, scaleX: element.width / Math.max(1, object.width ?? element.width), scaleY: element.height / Math.max(1, object.height ?? element.height), transparentCorners: false, cornerColor: "#e66f51" });
          setCanvasObjectMetadata(object, element);
          canvas.add(object);
        } catch {
          // Keep the rest of the document editable when an image cannot be loaded.
        }
      }
    }
    canvas.requestRenderAll();
    lastDocumentRef.current = JSON.stringify(document);
    lastEmittedRef.current = JSON.stringify(document);
    loadingRef.current = false;
    refreshSelection();
  }, [refreshSelection]);

  useEffect(() => {
    if (!canvasElementRef.current || fabricRef.current) return;
    const canvas = new Canvas(canvasElementRef.current, { width: value.width, height: value.height, preserveObjectStacking: true, selection: true });
    fabricRef.current = canvas;
    const handleModified = () => syncFromCanvas();
    const handleSelection = () => refreshSelection();
    const handleMoving = (event: { target?: FabricObject; e?: unknown }) => {
      const pointer = event.e as { shiftKey?: boolean } | undefined;
      if (event.target && !pointer?.shiftKey) showGuides(event.target);
    };
    const handleMouseUp = () => { clearGuides(); syncFromCanvas(); };
    const handleContext = (event: { target?: FabricObject; e?: { preventDefault: () => void; clientX: number; clientY: number } }) => {
      if (!event.target || canvasObject(event.target).announcementGuide) return;
      const item = canvasObject(event.target);
      if (item.announcementId && item.announcementType && event.e) {
        event.e.preventDefault();
        canvas.setActiveObject(event.target);
        setContextMenu({ x: event.e.clientX, y: event.e.clientY, type: item.announcementType });
        refreshSelection();
      }
    };
    canvas.on("object:modified", handleModified);
    canvas.on("object:moving", handleMoving);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("mouse:down", (event) => { const pointer = event.e as { button?: number }; if (pointer.button === 2) handleContext(event as { target?: FabricObject; e?: { preventDefault: () => void; clientX: number; clientY: number } }); });
    canvas.on("mouse:dblclick", (event) => {
      const target = event.target;
      if (target && canvasObject(target).announcementType === "rect") {
        addText(numberValue(target.left, 0) + 20, numberValue(target.top, 0) + 20, Math.max(120, target.getScaledWidth() - 40));
      }
    });
    canvas.on("text:changed", handleModified);
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    void loadDocument({ ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    return () => {
      canvas.off("object:modified", handleModified);
      canvas.off("object:moving", handleMoving);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("text:changed", handleModified);
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const font of GOOGLE_FONTS) {
      const id = `announcement-font-${font.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = googleFontUrl(font);
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (serialized === lastEmittedRef.current || !fabricRef.current) return;
    void loadDocument({ ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
  }, [activePage, currentPage, loadDocument, value]);

  function clearGuides() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().filter((object) => canvasObject(object).announcementGuide).forEach((object) => canvas.remove(object));
  }

  function showGuides(target: FabricObject) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    clearGuides();
    const width = currentPage.width;
    const height = currentPage.height;
    const left = numberValue(target.left, 0);
    const top = numberValue(target.top, 0);
    const objectWidth = target.getScaledWidth();
    const objectHeight = target.getScaledHeight();
    const snapX = [24, width / 2 - objectWidth / 2, width / 2, width - 24 - objectWidth, width - 24];
    const snapY = [24, height / 2 - objectHeight / 2, height / 2, height - 24 - objectHeight, height - 24];
    const nearestX = snapX.reduce((best, candidate) => Math.abs(candidate - left) < Math.abs(best - left) ? candidate : best, snapX[0]);
    const nearestY = snapY.reduce((best, candidate) => Math.abs(candidate - top) < Math.abs(best - top) ? candidate : best, snapY[0]);
    const threshold = 12;
    let guideX: number | null = null;
    let guideY: number | null = null;
    if (Math.abs(nearestX - left) <= threshold) {
      target.set({ left: nearestX });
      guideX = nearestX === width / 2 - objectWidth / 2 ? width / 2 : nearestX === width - 24 - objectWidth ? width - 24 : nearestX;
    }
    if (Math.abs(nearestY - top) <= threshold) {
      target.set({ top: nearestY });
      guideY = nearestY === height / 2 - objectHeight / 2 ? height / 2 : nearestY === height - 24 - objectHeight ? height - 24 : nearestY;
    }
    const guideOptions = { stroke: "#e66f51", strokeWidth: 1, strokeDashArray: [6, 5], selectable: false, evented: false };
    if (guideX !== null) {
      const line = new Line([guideX, 0, guideX, height], guideOptions);
      canvasObject(line).announcementGuide = true;
      canvas.add(line);
    }
    if (guideY !== null) {
      const line = new Line([0, guideY, width, guideY], guideOptions);
      canvasObject(line).announcementGuide = true;
      canvas.add(line);
    }
  }

  function publishCanvas(canvas: Canvas) {
    const nextPage = documentFromCanvas(canvas, { ...value, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    publish(withPage(value, activePage, { ...currentPage, width: nextPage.width, height: nextPage.height, background: nextPage.background, elements: nextPage.elements }));
  }

  function addText(left = 100, top = Math.max(100, currentPage.height / 2 - 45), width = Math.min(700, currentPage.width - 140)) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const element: Extract<AnnouncementElement, { type: "text" }> = { id: `text-${Date.now()}`, type: "text", x: left, y: top, width, height: 90, text: "Double-click to edit", fontSize: 34, fontFamily: "Arial", fill: "#17324d", align: "left", fontStyle: "normal" };
    const object = new Textbox(element.text, { left: element.x, top: element.y, width: element.width, fontSize: element.fontSize, fontFamily: element.fontFamily, fill: element.fill, editable: true, transparentCorners: false, cornerColor: "#e66f51" });
    object.set({ scaleY: element.height / Math.max(1, object.getScaledHeight()) });
    setCanvasObjectMetadata(object, element);
    canvas.add(object);
    canvas.setActiveObject(object);
    object.enterEditing();
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addShape(shape: "rect" | "circle" | "triangle" | "star" = "rect") {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const element: Extract<AnnouncementElement, { type: "rect" }> = { id: `shape-${Date.now()}`, type: "rect", shape, x: 100, y: Math.max(100, currentPage.height / 2 - 50), width: 260, height: 120, fill: "#e66f51", cornerRadius: 14 };
    const object = shapeObject(element);
    setCanvasObjectMetadata(object, element);
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addImage(url: string, alt = "") {
    const canvas = fabricRef.current;
    if (!canvas) return;
    void FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((object) => {
      const element: Extract<AnnouncementElement, { type: "image" }> = { id: `image-${Date.now()}`, type: "image", x: 100, y: 680, width: 700, height: 300, src: url, alt, cornerRadius: 14 };
      object.set({ left: element.x, top: element.y, scaleX: element.width / Math.max(1, object.width ?? element.width), scaleY: element.height / Math.max(1, object.height ?? element.height), transparentCorners: false, cornerColor: "#e66f51" });
      setCanvasObjectMetadata(object, element);
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      publishCanvas(canvas);
      refreshSelection();
    });
  }

  function updateSelected(patch: Record<string, unknown>) {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    const item = canvasObject(object);
    if ("announcementLink" in patch) item.announcementLink = String(patch.announcementLink ?? "");
    if ("announcementShape" in patch) item.announcementShape = patch.announcementShape as CanvasObject["announcementShape"];
    if ("shadowOptions" in patch) object.set({ shadow: patch.shadowOptions ? new Shadow(patch.shadowOptions as { color: string; blur: number; offsetX: number; offsetY: number }) : undefined });
    object.set(patch);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function addPage() {
    const nextPage: AnnouncementPage = { id: `page-${Date.now()}`, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: [] };
    const next = { ...value, pages: [...pages, nextPage] };
    setActivePage(pages.length);
    lastDocumentRef.current = JSON.stringify(next);
    lastEmittedRef.current = JSON.stringify(next);
    onChange(next);
  }

  function changePageSize(width: number, height: number) {
    const nextPage = { ...currentPage, width, height };
    const next = withPage(value, activePage, nextPage);
    publish(next);
    void loadDocument({ ...nextPage, version: 1, elements: nextPage.elements });
  }

  function downloadFile(name: string, contents: string, type: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([contents], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadBlob(name: string, blob: Blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function exportPageImages() {
    const canvas = fabricRef.current;
    if (!canvas) return [];
    const images: { page: AnnouncementPage; dataUrl: string }[] = [];
    for (const page of pages) {
      await loadDocument({ ...value, pages: undefined, width: page.width, height: page.height, background: page.background, elements: page.elements });
      images.push({ page, dataUrl: canvas.toDataURL({ format: "png", multiplier: 1 }) });
    }
    await loadDocument({ ...value, pages: undefined, width: currentPage.width, height: currentPage.height, background: currentPage.background, elements: currentPage.elements });
    return images;
  }

  function exportPng() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    downloadFile(`announcement-page-${activePage + 1}.png`, canvas.toDataURL({ format: "png", multiplier: 1 }), "image/png");
  }

  function exportSvg() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    downloadFile(`announcement-page-${activePage + 1}.svg`, canvas.toSVG(), "image/svg+xml");
  }

  async function exportZip() {
    const images = await exportPageImages();
    if (!images.length) return;
    const zip = new JSZip();
    images.forEach((image, index) => zip.file(`announcement-page-${index + 1}.png`, image.dataUrl.split(",")[1], { base64: true }));
    downloadBlob("announcement-pages.zip", await zip.generateAsync({ type: "blob" }));
  }

  async function exportPdf() {
    const images = await exportPageImages();
    if (!images.length) return;
    const first = images[0].page;
    const pdf = new jsPDF({ unit: "px", format: [first.width, first.height], orientation: first.width >= first.height ? "landscape" : "portrait" });
    images.forEach((image, index) => {
      if (index > 0) pdf.addPage([image.page.width, image.page.height], image.page.width >= image.page.height ? "landscape" : "portrait");
      pdf.addImage(image.dataUrl, "PNG", 0, 0, image.page.width, image.page.height);
    });
    pdf.save("announcement.pdf");
  }

  function exportHtml() {
    const html = pages.map((page) => announcementDocumentToHtml({ ...value, width: page.width, height: page.height, background: page.background, elements: page.elements })).join("\n");
    downloadFile("announcement.html", `<!doctype html><html><head><meta charset="utf-8"><title>Announcement</title></head><body>${html}</body></html>`, "text/html");
  }

  function printPdf() {
    const html = pages.map((page) => announcementDocumentToHtml({ ...value, width: page.width, height: page.height, background: page.background, elements: page.elements })).join('<div style="page-break-after:always"></div>');
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Announcement</title></head><body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.remove(object);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function duplicateSelected() {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    void object.clone().then((copy) => {
      const source = canvasObject(object);
      const duplicate = canvasObject(copy);
      duplicate.announcementId = `${source.announcementId ?? "element"}-${Date.now()}`;
      duplicate.announcementType = source.announcementType;
      duplicate.announcementAlt = source.announcementAlt;
      duplicate.announcementCornerRadius = source.announcementCornerRadius;
      duplicate.announcementStroke = source.announcementStroke;
      duplicate.announcementStrokeWidth = source.announcementStrokeWidth;
      (duplicate as CanvasObject & { announcementSrc?: string }).announcementSrc = (source as CanvasObject & { announcementSrc?: string }).announcementSrc;
      duplicate.set({ left: numberValue(object.left, 0) + 24, top: numberValue(object.top, 0) + 24 });
      canvas.add(copy);
      canvas.setActiveObject(copy);
      canvas.requestRenderAll();
      publishCanvas(canvas);
      refreshSelection();
    });
  }

  function moveLayer(direction: "up" | "down") {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    const index = canvas.getObjects().indexOf(object);
    const nextIndex = direction === "up" ? index + 1 : index - 1;
    if (nextIndex < 0 || nextIndex >= canvas.getObjects().length) return;
    canvas.moveObjectTo(object, nextIndex);
    canvas.requestRenderAll();
    publishCanvas(canvas);
    refreshSelection();
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [JSON.parse(lastDocumentRef.current) as AnnouncementDocument, ...items]);
    void loadDocument(previous);
    onChange(previous);
    lastDocumentRef.current = JSON.stringify(previous);
    lastEmittedRef.current = JSON.stringify(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, JSON.parse(lastDocumentRef.current) as AnnouncementDocument]);
    void loadDocument(next);
    onChange(next);
    lastDocumentRef.current = JSON.stringify(next);
    lastEmittedRef.current = JSON.stringify(next);
  }

  const canvasWidth = currentPage.width * zoom;
  const selectedText = selected?.type === "text";
  const usedFonts = Array.from(new Set(currentPage.elements.filter((element): element is Extract<AnnouncementElement, { type: "text" }> => element.type === "text").map((element) => element.fontFamily)));
  const filterFonts = (fonts: string[]) => fonts.filter((font) => !fontQuery || font.toLowerCase().includes(fontQuery.toLowerCase()));
  const groupedFonts = new Set([...usedFonts, ...COMMONLY_USED_FONTS, ...COMMON_FONTS]);
  const alignIcon = (align: "left" | "center" | "right") => align === "left" ? "≡" : align === "center" ? "≣" : "≡";
  return <div className="relative grid gap-3 overflow-hidden rounded-2xl border border-ink/10 bg-[#f3f4f6]" onContextMenu={(event) => event.preventDefault()}>
    <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-white px-3 py-2">
      <span className="mr-2 font-semibold text-ink">Design</span>
      <Button type="button" variant="secondary" onClick={() => addText()}>Text</Button>
      <select aria-label="Add shape" className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" value="" onChange={(event) => { if (event.target.value) addShape(event.target.value as "rect" | "circle" | "triangle" | "star"); }}>
        <option value="">Add shape</option><option value="rect">Square / rectangle</option><option value="circle">Circle</option><option value="triangle">Triangle</option><option value="star">Star</option>
      </select>
      <MediaPicker label="Images" permission="MANAGE_SETTINGS" onSelect={(asset) => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} />
      <Button type="button" variant="secondary" onClick={addPage}>Add page</Button>
      <select aria-label="Current page" className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm" value={activePage} onChange={(event) => setActivePage(Number(event.target.value))}>{pages.map((page, index) => <option key={page.id} value={index}>Page {index + 1}</option>)}</select>
      <select aria-label="Page size" className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm" value="" onChange={(event) => { const preset = PAGE_PRESETS.find((item) => item.label === event.target.value); if (preset) changePageSize(preset.width, preset.height); }}>
        <option value="">Page size</option>{PAGE_PRESETS.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
      </select>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm" onClick={() => { const width = Number(window.prompt("Page width in pixels", String(currentPage.width))); const height = Number(window.prompt("Page height in pixels", String(currentPage.height))); if (width >= 320 && height >= 320) changePageSize(width, height); }}>Custom size</button>
      <span className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink/60">Zoom <input aria-label="Canvas zoom" type="range" min="0.35" max="0.9" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></span>
      <Button type="button" variant="secondary" disabled={!history.length} onClick={undo}>Undo</Button>
      <Button type="button" variant="secondary" disabled={!future.length} onClick={redo}>Redo</Button>
      <div className="flex gap-1"><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportPng}>PNG</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportSvg}>SVG</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportZip}>ZIP</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportHtml}>HTML</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={exportPdf}>PDF</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" onClick={printPdf}>Print</button></div>
    </div>
    <div className="grid min-w-0 lg:grid-cols-[180px_minmax(0,1fr)_260px]">
      <aside className="hidden border-r border-ink/10 bg-white p-3 lg:block"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Add to page</p><div className="mt-3 grid gap-2"><button type="button" onClick={() => addText()} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="block text-lg font-bold">T</span><span className="text-xs font-semibold">Text box</span></button><div className="grid grid-cols-2 gap-2">{(["rect", "circle", "triangle", "star"] as const).map((shape) => <button key={shape} type="button" onClick={() => addShape(shape)} className="focus-ring rounded-xl border border-ink/10 p-2 text-left text-xs capitalize hover:border-coral">{shape}</button>)}</div><div className="rounded-xl border border-ink/10 p-3"><MediaPicker label="Add image" permission="MANAGE_SETTINGS" onSelect={(asset) => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} /></div></div><label className="mt-5 grid gap-2 text-xs font-semibold text-ink/60">Page background<input type="color" value={currentPage.background} onChange={(event) => { const canvas = fabricRef.current; if (!canvas) return; canvas.backgroundColor = event.target.value; canvas.requestRenderAll(); publish(withPage(value, activePage, { ...currentPage, background: event.target.value })); }} className="h-10 w-full rounded border border-ink/10 bg-white p-1" /></label></aside>
      <div className="min-w-0 overflow-auto p-5 sm:p-8"><div className="mx-auto overflow-hidden shadow-2xl" style={{ width: canvasWidth, height: currentPage.height * zoom }}><div style={{ width: currentPage.width, height: currentPage.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}><canvas ref={canvasElementRef} /></div></div><p className="mt-4 text-center text-xs text-ink/50">Drag objects toward the dashed guides to align them. Hold Shift while dragging to bypass snapping. Double-click text or shapes to edit.</p></div>
      <aside className="border-t border-ink/10 bg-white p-3 lg:border-l lg:border-t-0"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Properties</p>{selected ? <div className="mt-3 grid gap-3 text-xs"><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 font-semibold text-ink/60">X<input type="number" value={Math.round(selected.x)} onChange={(event) => updateSelected({ left: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><label className="grid gap-1 font-semibold text-ink/60">Y<input type="number" value={Math.round(selected.y)} onChange={(event) => updateSelected({ top: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label></div>{selectedText && <><label className="grid gap-1 font-semibold text-ink/60">Font search<input value={fontQuery} onChange={(event) => setFontQuery(event.target.value)} placeholder="Search fonts" className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><label className="grid gap-1 font-semibold text-ink/60">Font<select value={selected.fontFamily ?? "Arial"} onChange={(event) => updateSelected({ fontFamily: event.target.value })} className="focus-ring rounded border border-ink/15 px-2 py-1"><optgroup label="Fonts used in canvas">{filterFonts(usedFonts).map((font) => <option key={`used-${font}`}>{font}</option>)}</optgroup><optgroup label="Commonly used fonts">{filterFonts(COMMONLY_USED_FONTS).map((font) => <option key={`common-used-${font}`}>{font}</option>)}</optgroup><optgroup label="Common fonts">{filterFonts(COMMON_FONTS).map((font) => <option key={`common-${font}`}>{font}</option>)}</optgroup><optgroup label="Alphabetical">{filterFonts(GOOGLE_FONTS.filter((font) => !groupedFonts.has(font))).sort((a, b) => a.localeCompare(b)).map((font) => <option key={`alphabetical-${font}`}>{font}</option>)}</optgroup></select></label><label className="grid gap-1 font-semibold text-ink/60">Size (px)<select value={Math.round(selected.fontSize ?? 24)} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1">{FONT_SIZES.map((size) => <option key={size} value={size}>{size}px</option>)}</select></label><div className="flex gap-2"><button type="button" aria-label="Bold" className="focus-ring rounded border border-ink/15 px-2 py-1 font-bold" onClick={() => updateSelected({ fontWeight: selected.fontStyle === "bold" ? "normal" : "bold" })}>B</button><button type="button" aria-label="Italic" className="focus-ring rounded border border-ink/15 px-2 py-1 italic" onClick={() => updateSelected({ fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}>I</button>{(["left", "center", "right"] as const).map((align) => <button key={align} type="button" aria-label={`${align} align`} title={`${align} align`} className={`focus-ring rounded border px-2 py-1 text-lg leading-none ${selected.align === align ? "border-coral text-coral" : "border-ink/15"}`} onClick={() => updateSelected({ textAlign: align })}>{alignIcon(align)}</button>)}</div><label className="grid gap-1 font-semibold text-ink/60">Link (optional)<input type="url" value={selected.link ?? ""} onChange={(event) => updateSelected({ announcementLink: event.target.value })} placeholder="https://..." className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={() => updateSelected({ shadowOptions: { color: "#00000066", blur: 8, offsetX: 2, offsetY: 2 } })}>Text shadow</Button><Button type="button" variant="secondary" onClick={() => updateSelected({ shadowOptions: { color: "#ffffffcc", blur: 0, offsetX: 0, offsetY: 2 } })}>Text lift</Button></div></>}{selected.type === "rect" && <label className="grid gap-1 font-semibold text-ink/60">Shape<select value={selected.shape ?? "rect"} onChange={(event) => updateSelected({ announcementShape: event.target.value })} className="focus-ring rounded border border-ink/15 px-2 py-1"><option value="rect">Rectangle</option><option value="circle">Circle</option><option value="triangle">Triangle</option><option value="star">Star</option></select></label>}{selected.type !== "image" && <label className="grid gap-1 font-semibold text-ink/60">Color<input type="color" value={selected.fill?.startsWith("#") ? selected.fill : "#17324d"} onChange={(event) => updateSelected({ fill: event.target.value })} className="h-9 w-full rounded border border-ink/10 p-1" /></label>}<label className="grid gap-1 font-semibold text-ink/60">Opacity<input type="range" min="0.1" max="1" step="0.05" value={selected.opacity} onChange={(event) => updateSelected({ opacity: Number(event.target.value) })} /></label><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={duplicateSelected}>Duplicate</Button><Button type="button" variant="secondary" onClick={deleteSelected}>Delete</Button></div><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={() => moveLayer("up")}>Bring forward</Button><Button type="button" variant="secondary" onClick={() => moveLayer("down")}>Send backward</Button></div></div> : <p className="mt-3 text-xs leading-5 text-ink/50">Select an object to edit its properties, or right-click for item actions.</p>}<div className="mt-6 border-t border-ink/10 pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Layers</p><div className="mt-2 grid gap-1">{layers.map((layer) => <button type="button" key={layer.id} className={`focus-ring truncate rounded px-2 py-1 text-left text-xs ${selected?.id === layer.id ? "bg-coral/10 font-semibold text-coral" : "hover:bg-mist"}`} onClick={() => { const canvas = fabricRef.current; const object = canvas?.getObjects().find((candidate) => canvasObject(candidate).announcementId === layer.id); if (canvas && object) { canvas.setActiveObject(object); canvas.requestRenderAll(); refreshSelection(); } }}>{layer.type === "text" ? layer.text.slice(0, 24) : layer.type === "image" ? "Image" : `${layer.shape ?? "Shape"}`}</button>)}</div></div></aside>
    </div>
    {contextMenu && <div className="fixed z-50 grid min-w-40 gap-1 rounded-lg border border-ink/15 bg-white p-1 text-sm shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(null)}><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={() => { duplicateSelected(); setContextMenu(null); }}>Duplicate</button><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={() => { moveLayer("up"); setContextMenu(null); }}>Bring forward</button><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={() => { moveLayer("down"); setContextMenu(null); }}>Send backward</button><button type="button" className="rounded px-3 py-2 text-left text-coral hover:bg-mist" onClick={() => { deleteSelected(); setContextMenu(null); }}>Delete</button></div>}
  </div>;
}

export function emptyAnnouncementDocument(title = "") {
  return defaultAnnouncementDocument(title);
}
