"use client";

import { useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva/lib/ReactKonvaCore";
import "konva/lib/shapes/Rect";
import "konva/lib/shapes/Text";
import "konva/lib/shapes/Image";
import "konva/lib/shapes/Transformer";
import type Konva from "konva";
import { Button } from "@/components/ui";
import { defaultAnnouncementDocument, type AnnouncementDocument, type AnnouncementElement } from "@/lib/announcement-document";

function useHtmlImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const next = new window.Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.onerror = () => setImage(null);
    next.src = src;
    return () => { next.onload = null; next.onerror = null; };
  }, [src]);
  return image;
}

function ImageElement({ element, selected, onSelect, onChange }: { element: Extract<AnnouncementElement, { type: "image" }>; selected: boolean; onSelect: () => void; onChange: (patch: Partial<AnnouncementElement>) => void }) {
  const image = useHtmlImage(element.src);
  const nodeRef = useRef<Konva.Image>(null);
  return <KonvaImage ref={nodeRef} image={image ?? undefined} x={element.x} y={element.y} width={element.width} height={element.height} cornerRadius={element.cornerRadius} draggable onClick={onSelect} onTap={onSelect} onDragEnd={(event) => onChange({ x: event.target.x(), y: event.target.y() })} onTransformEnd={() => { const node = nodeRef.current; if (!node) return; onChange({ x: node.x(), y: node.y(), width: Math.max(40, node.width() * node.scaleX()), height: Math.max(40, node.height() * node.scaleY()) }); node.scaleX(1); node.scaleY(1); }} opacity={selected ? 0.9 : 1} />;
}

export function AnnouncementCanvasEditor({ value, onChange }: { value: AnnouncementDocument; onChange: (value: AnnouncementDocument) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<AnnouncementDocument[]>([]);
  const [future, setFuture] = useState<AnnouncementDocument[]>([]);
  const [scale, setScale] = useState(0.52);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);

  useEffect(() => {
    const updateScale = () => setScale(Math.min(0.72, Math.max(0.35, (window.innerWidth - 420) / value.width)));
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [value.width]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer || !selectedNodeRef.current) return;
    transformer.nodes([selectedNodeRef.current]);
    transformer.getLayer()?.batchDraw();
  }, [selectedId]);

  function commit(next: AnnouncementDocument) {
    setHistory((items) => [...items.slice(-30), value]);
    setFuture([]);
    onChange(next);
  }

  function updateElement(id: string, patch: Partial<AnnouncementElement>) {
    commit({ ...value, elements: value.elements.map((element) => element.id === id ? { ...element, ...patch } as AnnouncementElement : element) });
  }

  function addText() {
    const id = `text-${Date.now()}`;
    commit({ ...value, elements: [...value.elements, { id, type: "text", x: 90, y: 560, width: 720, height: 100, text: "New announcement text", fontSize: 30, fontFamily: "Arial", fill: "#17324d", align: "left", fontStyle: "normal" }] });
    setSelectedId(id);
  }

  function addShape() {
    const id = `shape-${Date.now()}`;
    commit({ ...value, elements: [...value.elements, { id, type: "rect", x: 100, y: 560, width: 700, height: 80, fill: "#e66f51", cornerRadius: 12 }] });
    setSelectedId(id);
  }

  function addImage() {
    const src = window.prompt("Enter an image URL or uploaded media URL.");
    if (!src || !/^(https?:\/\/|\/)/i.test(src.trim())) return;
    const id = `image-${Date.now()}`;
    commit({ ...value, elements: [...value.elements, { id, type: "image", x: 100, y: 680, width: 700, height: 300, src: src.trim(), alt: "", cornerRadius: 12 }] });
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selectedId) return;
    commit({ ...value, elements: value.elements.filter((element) => element.id !== selectedId) });
    setSelectedId(null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [value, ...items]);
    onChange(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, value]);
    onChange(next);
  }

  const selected = value.elements.find((element) => element.id === selectedId);
  const canvasStyle = { width: value.width * scale, height: value.height * scale };
  return <div className="grid gap-4"><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="secondary" onClick={addText}>Add text</Button><Button type="button" variant="secondary" onClick={addShape}>Add shape</Button><Button type="button" variant="secondary" onClick={addImage}>Add image</Button><Button type="button" variant="secondary" disabled={!selectedId} onClick={removeSelected}>Delete selected</Button><Button type="button" variant="secondary" disabled={!history.length} onClick={undo}>Undo</Button><Button type="button" variant="secondary" disabled={!future.length} onClick={redo}>Redo</Button><label className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink/60">Background<input type="color" value={value.background} onChange={(event) => commit({ ...value, background: event.target.value })} className="h-8 w-12 rounded border border-ink/15 bg-white p-1" /></label></div><div className="overflow-auto rounded-xl border border-ink/10 bg-ink/5 p-4"><div style={canvasStyle} className="mx-auto shadow-xl"><Stage width={value.width} height={value.height} scaleX={scale} scaleY={scale} onMouseDown={(event) => { if (event.target === event.target.getStage()) setSelectedId(null); }}><Layer><Rect x={0} y={0} width={value.width} height={value.height} fill={value.background} listening={false} />{value.elements.map((element) => element.type === "text" ? <Text key={element.id} ref={(node) => { if (element.id === selectedId) selectedNodeRef.current = node; }} x={element.x} y={element.y} width={element.width} height={element.height} text={element.text} fontSize={element.fontSize} fontFamily={element.fontFamily} fill={element.fill} align={element.align} fontStyle={element.fontStyle} draggable onClick={() => setSelectedId(element.id)} onTap={() => setSelectedId(element.id)} onDragEnd={(event) => updateElement(element.id, { x: event.target.x(), y: event.target.y() })} onDblClick={() => { const text = window.prompt("Edit text", element.text); if (text !== null) updateElement(element.id, { text: text.slice(0, 5000) }); }} /> : element.type === "rect" ? <Rect key={element.id} ref={(node) => { if (element.id === selectedId) selectedNodeRef.current = node; }} x={element.x} y={element.y} width={element.width} height={element.height} fill={element.fill} cornerRadius={element.cornerRadius} stroke={element.stroke} strokeWidth={element.strokeWidth} draggable onClick={() => setSelectedId(element.id)} onTap={() => setSelectedId(element.id)} onDragEnd={(event) => updateElement(element.id, { x: event.target.x(), y: event.target.y() })} /> : <ImageElement key={element.id} element={element} selected={element.id === selectedId} onSelect={() => setSelectedId(element.id)} onChange={(patch) => updateElement(element.id, patch)} />)}{selected && selected.type !== "text" && <Transformer ref={transformerRef} rotateEnabled={false} boundBoxFunc={(oldBox, newBox) => newBox.width < 40 || newBox.height < 40 ? oldBox : newBox} />}</Layer></Stage></div></div><p className="text-xs text-ink/55">Select an element to move it. Double-click text to edit. Images and shapes can be resized with the handles.</p></div>;
}

export function emptyAnnouncementDocument(title = "") {
  return defaultAnnouncementDocument(title);
}
