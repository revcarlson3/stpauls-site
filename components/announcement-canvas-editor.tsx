"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, Rect, Textbox, type FabricObject } from "fabric";
import { Button } from "@/components/ui";
import { MediaPicker } from "@/components/media-picker";
import { defaultAnnouncementDocument, type AnnouncementDocument, type AnnouncementElement } from "@/lib/announcement-document";

type CanvasObject = FabricObject & {
  announcementId?: string;
  announcementType?: AnnouncementElement["type"];
  announcementAlt?: string;
  announcementCornerRadius?: number;
  announcementStroke?: string;
  announcementStrokeWidth?: number;
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
};

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
    height
  };
}

function documentFromCanvas(canvas: Canvas, value: AnnouncementDocument): AnnouncementDocument {
  const elements: AnnouncementElement[] = canvas.getObjects().map((object) => {
    const item = canvasObject(object);
    const type = item.announcementType;
    const id = item.announcementId;
    const x = numberValue(object.left, 0);
    const y = numberValue(object.top, 0);
    const width = Math.max(1, object.getScaledWidth());
    const height = Math.max(1, object.getScaledHeight());
    if (type === "text" && id) {
      const textObject = object as FabricObject & { text?: string; fontSize?: number; fontFamily?: string; textAlign?: "left" | "center" | "right"; fontStyle?: "normal" | "italic"; fontWeight?: string };
      return { id, type, x, y, width, height, text: (textObject.text ?? "").slice(0, 5000), fontSize: numberValue(textObject.fontSize, 24), fontFamily: (textObject.fontFamily ?? "Arial").slice(0, 80), fill: typeof object.fill === "string" ? object.fill : "#17324d", align: textObject.textAlign ?? "left", fontStyle: textObject.fontWeight === "bold" ? "bold" : textObject.fontStyle === "italic" ? "italic" : "normal" };
    }
    if (type === "image" && id) {
      return { id, type, x, y, width, height, src: String((item as CanvasObject & { announcementSrc?: string }).announcementSrc ?? ""), alt: item.announcementAlt ?? "", cornerRadius: item.announcementCornerRadius ?? 0 };
    }
    return { id: id ?? `shape-${Date.now()}`, type: "rect", x, y, width, height, fill: typeof object.fill === "string" ? object.fill : "#e66f51", cornerRadius: item.announcementCornerRadius ?? 0, stroke: item.announcementStroke, strokeWidth: item.announcementStrokeWidth };
  });
  return { ...value, background: typeof canvas.backgroundColor === "string" ? canvas.backgroundColor : value.background, elements };
}

function setCanvasObjectMetadata(object: FabricObject, element: AnnouncementElement) {
  const item = canvasObject(object);
  item.announcementId = element.id;
  item.announcementType = element.type;
  if (element.type === "image") {
    item.announcementAlt = element.alt;
    item.announcementCornerRadius = element.cornerRadius;
    (item as CanvasObject & { announcementSrc?: string }).announcementSrc = element.src;
  }
  if (element.type === "rect") {
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
  const [layers, setLayers] = useState<AnnouncementElement[]>(value.elements);

  const refreshSelection = useCallback(() => {
    const canvas = fabricRef.current;
    setSelected(selectedObject(canvas?.getActiveObject()));
    setLayers(canvas ? canvas.getObjects().map((object) => {
      const item = canvasObject(object);
      const element = value.elements.find((candidate) => candidate.id === item.announcementId);
      return element ?? { id: item.announcementId ?? "unknown", type: item.announcementType ?? "rect", x: numberValue(object.left, 0), y: numberValue(object.top, 0), width: Math.max(1, object.getScaledWidth()), height: Math.max(1, object.getScaledHeight()), fill: "#e66f51", cornerRadius: 0 } as AnnouncementElement;
    }).reverse() : value.elements);
  }, [value.elements]);

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
    publish(documentFromCanvas(canvas, value));
    refreshSelection();
  }, [publish, refreshSelection, value]);

  const loadDocument = useCallback(async (document: AnnouncementDocument) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    loadingRef.current = true;
    canvas.clear();
    canvas.backgroundColor = document.background;
    for (const element of document.elements) {
      if (element.type === "text") {
        const object = new Textbox(element.text, { left: element.x, top: element.y, width: element.width, fontSize: element.fontSize, fontFamily: element.fontFamily, fill: element.fill, textAlign: element.align, fontWeight: element.fontStyle === "bold" ? "bold" : "normal", fontStyle: element.fontStyle === "italic" ? "italic" : "normal", editable: true, transparentCorners: false, cornerColor: "#e66f51" });
        object.set({ scaleY: element.height / Math.max(1, object.getScaledHeight()) });
        setCanvasObjectMetadata(object, element);
        canvas.add(object);
      } else if (element.type === "rect") {
        const object = new Rect({ left: element.x, top: element.y, width: element.width, height: element.height, fill: element.fill, rx: element.cornerRadius, ry: element.cornerRadius, stroke: element.stroke, strokeWidth: element.strokeWidth, transparentCorners: false, cornerColor: "#e66f51" });
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
    canvas.on("object:modified", handleModified);
    canvas.on("text:changed", handleModified);
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    void loadDocument(value);
    return () => {
      canvas.off("object:modified", handleModified);
      canvas.off("text:changed", handleModified);
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (serialized === lastEmittedRef.current || !fabricRef.current) return;
    void loadDocument(value);
  }, [loadDocument, value]);

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const element: Extract<AnnouncementElement, { type: "text" }> = { id: `text-${Date.now()}`, type: "text", x: 100, y: 540, width: 700, height: 90, text: "Double-click to edit", fontSize: 34, fontFamily: "Arial", fill: "#17324d", align: "left", fontStyle: "normal" };
    const object = new Textbox(element.text, { left: element.x, top: element.y, width: element.width, fontSize: element.fontSize, fontFamily: element.fontFamily, fill: element.fill, editable: true, transparentCorners: false, cornerColor: "#e66f51" });
    object.set({ scaleY: element.height / Math.max(1, object.getScaledHeight()) });
    setCanvasObjectMetadata(object, element);
    canvas.add(object);
    canvas.setActiveObject(object);
    object.enterEditing();
    canvas.requestRenderAll();
    publish(documentFromCanvas(canvas, value));
    refreshSelection();
  }

  function addShape() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const element: Extract<AnnouncementElement, { type: "rect" }> = { id: `shape-${Date.now()}`, type: "rect", x: 100, y: 540, width: 700, height: 100, fill: "#e66f51", cornerRadius: 14 };
    const object = new Rect({ left: element.x, top: element.y, width: element.width, height: element.height, fill: element.fill, rx: element.cornerRadius, ry: element.cornerRadius, transparentCorners: false, cornerColor: "#e66f51" });
    setCanvasObjectMetadata(object, element);
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    publish(documentFromCanvas(canvas, value));
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
      publish(documentFromCanvas(canvas, value));
      refreshSelection();
    });
  }

  function updateSelected(patch: Record<string, unknown>) {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    object.set(patch);
    canvas.requestRenderAll();
    publish(documentFromCanvas(canvas, value));
    refreshSelection();
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.remove(object);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    publish(documentFromCanvas(canvas, value));
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
      publish(documentFromCanvas(canvas, value));
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
    publish(documentFromCanvas(canvas, value));
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

  const canvasWidth = value.width * zoom;
  const selectedText = selected?.type === "text";
  return <div className="grid gap-3 overflow-hidden rounded-2xl border border-ink/10 bg-[#f3f4f6]">
    <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-white px-3 py-2">
      <span className="mr-2 font-semibold text-ink">Design</span>
      <Button type="button" variant="secondary" onClick={addText}>Text</Button>
      <Button type="button" variant="secondary" onClick={addShape}>Shape</Button>
      <MediaPicker label="Images" permission="MANAGE_SETTINGS" onSelect={(asset) => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} />
      <span className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink/60">Zoom <input aria-label="Canvas zoom" type="range" min="0.35" max="0.9" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></span>
      <Button type="button" variant="secondary" disabled={!history.length} onClick={undo}>Undo</Button>
      <Button type="button" variant="secondary" disabled={!future.length} onClick={redo}>Redo</Button>
    </div>
    <div className="grid min-w-0 lg:grid-cols-[180px_minmax(0,1fr)_220px]">
      <aside className="hidden border-r border-ink/10 bg-white p-3 lg:block"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Add to page</p><div className="mt-3 grid gap-2"><button type="button" onClick={addText} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="block text-lg font-bold">T</span><span className="text-xs font-semibold">Text box</span></button><button type="button" onClick={addShape} className="focus-ring rounded-xl border border-ink/10 p-3 text-left hover:border-coral"><span className="mb-2 block h-6 w-10 rounded bg-coral" /><span className="text-xs font-semibold">Shape</span></button><div className="rounded-xl border border-ink/10 p-3"><MediaPicker label="Add image" permission="MANAGE_SETTINGS" onSelect={(asset) => addImage(asset.url, asset.altText ?? asset.title ?? asset.originalName)} /></div></div><label className="mt-5 grid gap-2 text-xs font-semibold text-ink/60">Page background<input type="color" value={value.background} onChange={(event) => { const canvas = fabricRef.current; if (!canvas) return; canvas.backgroundColor = event.target.value; canvas.requestRenderAll(); publish(documentFromCanvas(canvas, { ...value, background: event.target.value })); }} className="h-10 w-full rounded border border-ink/10 bg-white p-1" /></label></aside>
      <div className="min-w-0 overflow-auto p-5 sm:p-8"><div className="mx-auto overflow-hidden shadow-2xl" style={{ width: canvasWidth, height: value.height * zoom }}><div style={{ width: value.width, height: value.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}><canvas ref={canvasElementRef} /></div></div><p className="mt-4 text-center text-xs text-ink/50">Click an object to select it. Double-click text to edit directly on the canvas. Drag, resize, rotate, duplicate, and layer objects without prompts.</p></div>
      <aside className="border-t border-ink/10 bg-white p-3 lg:border-l lg:border-t-0"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Properties</p>{selected ? <div className="mt-3 grid gap-3 text-xs"><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 font-semibold text-ink/60">X<input type="number" value={Math.round(selected.x)} onChange={(event) => updateSelected({ left: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><label className="grid gap-1 font-semibold text-ink/60">Y<input type="number" value={Math.round(selected.y)} onChange={(event) => updateSelected({ top: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label></div>{selectedText && <><label className="grid gap-1 font-semibold text-ink/60">Font<select value={selected.fontFamily ?? "Arial"} onChange={(event) => updateSelected({ fontFamily: event.target.value })} className="focus-ring rounded border border-ink/15 px-2 py-1"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option></select></label><label className="grid gap-1 font-semibold text-ink/60">Size<input type="number" min="8" max="180" value={Math.round(selected.fontSize ?? 24)} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} className="focus-ring rounded border border-ink/15 px-2 py-1" /></label><div className="flex gap-2"><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 font-bold" onClick={() => updateSelected({ fontWeight: selected.fontStyle === "bold" ? "normal" : "bold" })}>B</button><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 italic" onClick={() => updateSelected({ fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}>I</button>{(["left", "center", "right"] as const).map((align) => <button key={align} type="button" className={`focus-ring rounded border px-2 py-1 ${selected.align === align ? "border-coral text-coral" : "border-ink/15"}`} onClick={() => updateSelected({ textAlign: align })}>{align[0].toUpperCase()}</button>)}</div></>}{selected.type !== "image" && <label className="grid gap-1 font-semibold text-ink/60">Color<input type="color" value={selected.fill?.startsWith("#") ? selected.fill : "#17324d"} onChange={(event) => updateSelected({ fill: event.target.value })} className="h-9 w-full rounded border border-ink/10 p-1" /></label>}<label className="grid gap-1 font-semibold text-ink/60">Opacity<input type="range" min="0.1" max="1" step="0.05" value={selected.opacity} onChange={(event) => updateSelected({ opacity: Number(event.target.value) })} /></label><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={duplicateSelected}>Duplicate</Button><Button type="button" variant="secondary" onClick={deleteSelected}>Delete</Button></div><div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={() => moveLayer("up")}>Bring forward</Button><Button type="button" variant="secondary" onClick={() => moveLayer("down")}>Send backward</Button></div></div> : <p className="mt-3 text-xs leading-5 text-ink/50">Select an object to edit its properties, or double-click text to start typing.</p>}<div className="mt-6 border-t border-ink/10 pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Layers</p><div className="mt-2 grid gap-1">{layers.map((layer) => <button type="button" key={layer.id} className={`focus-ring truncate rounded px-2 py-1 text-left text-xs ${selected?.id === layer.id ? "bg-coral/10 font-semibold text-coral" : "hover:bg-mist"}`} onClick={() => { const canvas = fabricRef.current; const object = canvas?.getObjects().find((candidate) => canvasObject(candidate).announcementId === layer.id); if (canvas && object) { canvas.setActiveObject(object); canvas.requestRenderAll(); refreshSelection(); } }}>{layer.type === "text" ? layer.text.slice(0, 24) : layer.type === "image" ? "Image" : "Shape"}</button>)}</div></div></aside>
    </div>
  </div>;
}

export function emptyAnnouncementDocument(title = "") {
  return defaultAnnouncementDocument(title);
}
