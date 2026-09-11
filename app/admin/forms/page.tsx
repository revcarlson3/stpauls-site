"use client";

import { createContext, useContext, useEffect, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, Container } from "@/components/ui";
import { MediaPicker } from "@/components/media-picker";
import { FormRenderer } from "@/components/form-renderer";
import { RichTextField } from "@/app/admin/editor/editor-canvas";
import { defaultFormDefinition, defaultGroupSettings, formFieldGroups, formFieldTypeLabel, formFieldTypes, makeFormId, normalizeFormDefinition, type FormCondition, type FormDefinition, type FormField, type FormFieldType, type FormOption, type FormStyle, type FormStyleSettings, type FormExportSettings } from "@/lib/form-config";

type FormRecord = { id: string; name: string; slug: string; status: string; enabled: boolean; definition: FormDefinition; notificationSettings?: Record<string, unknown>; exportSettings?: Record<string, unknown>; _count?: { submissions: number } };
type SubmissionRecord = { id: string; values: Record<string, unknown>; createdAt: string };
type FormNotification = {
  id: string;
  name: string;
  enabled: boolean;
  recipientMode: "email" | "field";
  recipients: string;
  recipientField: string;
  subject: string;
  body: string;
  format: "html" | "text";
  attachPdf: boolean;
  attachmentUrl: string;
  attachmentName: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  bcc: string;
  cc: string;
};
const palette = formFieldTypes.filter((type) => !["name", "address"].includes(type));
const blank = { name: "", slug: "", status: "DRAFT", enabled: true };
const blankNotification: FormNotification = { id: "", name: "New notification", enabled: true, recipientMode: "email", recipients: "", recipientField: "", subject: "New form submission", body: "<p>A new form submission was received.</p>", format: "html", attachPdf: true, attachmentUrl: "", attachmentName: "", fromName: "", fromEmail: "", replyTo: "", bcc: "", cc: "" };
const ConditionalContext = createContext<{ field: FormField; allFields: FormField[]; update: (changes: Partial<FormField>) => void } | null>(null);
function collectFormFields(fields: FormField[]): FormField[] {
  return fields.flatMap((field) => {
    const nestedItems = Array.isArray(field.settings?.items) ? field.settings.items.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && Array.isArray((item as { fields?: unknown }).fields) ? (item as { fields: FormField[] }).fields : []) : [];
    const columnFields = Array.isArray(field.settings?.columnFields) ? field.settings.columnFields.flatMap((column) => Array.isArray(column) ? column as FormField[] : []) : [];
    return [field, ...collectFormFields([...nestedItems, ...columnFields])];
  });
}
const canvasCollisionDetection: CollisionDetection = (args) => {
  const activeKind = String(args.active.data.current?.kind ?? "");
  if (!["canvas-field", "column-field", "layout-field"].includes(activeKind)) return closestCenter(args);
  const allowedKinds = activeKind === "layout-field"
    ? ["layout-field", "layout-item"]
    : activeKind === "column-field"
      ? ["column-field", "column", "step"]
      : ["canvas-field", "column-field", "column", "step"];
  const targets = args.droppableContainers.filter((container) => allowedKinds.includes(String(container.data.current?.kind)));
  const pointerHits = pointerWithin({ ...args, droppableContainers: targets });
  const columnTargets = targets.filter((container) => container.data.current?.kind === "column");
  const columnHit = pointerHits.find((container) => container.data?.current?.kind === "column")
    ?? rectIntersection({ ...args, droppableContainers: columnTargets }).find((container) => container.data?.current?.kind === "column");
  // A one-column container fills the same rectangle as its sortable canvas field.
  // Prefer the nested column so an outside field can be dropped into it.
  if (activeKind === "canvas-field" && columnHit) return [columnHit];
  const fieldHit = pointerHits.find((container) => container.data?.current?.kind === activeKind);
  if (fieldHit) return [fieldHit];
  if (activeKind === "layout-field") {
    const layoutHit = pointerHits.find((container) => container.data?.current?.kind === "layout-item");
    if (layoutHit) return [layoutHit];
  }
  if (columnHit) return [columnHit];
  const otherFieldHit = pointerHits.find((container) => container.data?.current?.kind === "canvas-field" || container.data?.current?.kind === "column-field" || container.data?.current?.kind === "layout-field");
  if (otherFieldHit) return [otherFieldHit];
  const stepHit = pointerHits.find((container) => container.data?.current?.kind === "step");
  if (stepHit) return [stepHit];
  const fields = targets.filter((container) => container.data.current?.kind === "canvas-field" || container.data.current?.kind === "column-field" || container.data.current?.kind === "layout-field" || container.data.current?.kind === "layout-item");
  const fallbackTargets = activeKind === "canvas-field" || activeKind === "column-field"
    ? [...columnTargets, ...fields, ...targets.filter((container) => container.data.current?.kind === "step")]
    : fields.length ? fields : targets;
  return closestCenter({ ...args, droppableContainers: fallbackTargets });
};

function PaletteDragItem({ id, children, onClick }: { id: string; children: ReactNode; onClick: () => void }) {
  const isGroup = id.startsWith("palette-group:");
  const isContainer = id.startsWith("palette-container:");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: isGroup ? { kind: "palette-group", groupId: id.replace(/^palette-group:/, "") } : isContainer ? { kind: "palette-container", container: id.replace(/^palette-container:/, "") } : { kind: "palette", type: id.replace(/^palette:/, "") } });
  return <button ref={setNodeRef} type="button" onClick={onClick} {...listeners} {...attributes} className={`focus-ring rounded-lg border border-ink/15 p-2 text-left transition ${isDragging ? "scale-105 border-coral bg-coral/10 opacity-40 shadow-xl" : "hover:border-coral hover:bg-coral/5"}`}>{children}</button>;
}

function SortableCanvasField({ id, disabled, columnSpan = 12, children, selected, onClick, onContextMenu }: { id: string; disabled?: boolean; columnSpan?: number; children: ReactNode; selected: boolean; onClick: () => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled, data: { kind: "canvas-field", id: id.replace(/^canvas:/, "") } });
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(event);
    if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ")) onClick();
  };
  return <div ref={setNodeRef} onClick={onClick} onContextMenu={onContextMenu} {...listeners} {...attributes} onKeyDown={handleKeyDown} style={{ gridColumn: `span ${Math.min(12, Math.max(1, columnSpan))}`, transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined, touchAction: "none", willChange: "transform", visibility: isDragging ? "hidden" : "visible" }} className={`focus-ring relative cursor-grab rounded-lg border p-3 text-left transition-all active:cursor-grabbing ${isDragging ? "scale-[1.02] rotate-1 border-coral bg-white opacity-75 shadow-2xl ring-2 ring-coral/20" : selected ? "border-coral bg-coral/5" : "border-ink/10 bg-mist/30"}`}>{children}</div>;
}

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id, data: { kind: "column", id } });
  return <div ref={setNodeRef} role="group" aria-label={`Form column drop target ${Number(id.split(":").pop()) + 1}`} className={`min-h-24 min-w-0 w-full rounded-lg border p-2 transition-all ${isOver ? "scale-[1.01] border-coral border-dashed bg-coral/10 shadow-[0_0_0_4px_rgba(217,107,82,.12)]" : "border-ink/10 bg-white/80"}`}>{children}</div>;
}

function SortableColumnField({ id, item, containerId, columnIndex, onSelect, onContextMenu }: { id: string; item: FormField; containerId: string; columnIndex: number; onSelect: () => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { kind: "column-field", fieldId: item.id, containerId, columnIndex } });
  return <button ref={setNodeRef} type="button" onClick={onSelect} onContextMenu={onContextMenu} {...listeners} {...attributes} style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none", visibility: isDragging ? "hidden" : "visible" }} className={`focus-ring w-full rounded-md border px-2 py-1.5 text-left text-xs font-semibold ${isDragging ? "border-coral bg-white shadow-lg" : "border-ink/10 bg-mist/40 hover:border-coral"}`}>{item.label}</button>;
}

function SortableLayoutField({ id, item, layoutId, itemIndex, onSelect, onContextMenu }: { id: string; item: FormField; layoutId: string; itemIndex: number; onSelect: () => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { kind: "layout-field", fieldId: item.id, layoutId, itemIndex } });
  return <button ref={setNodeRef} type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} onContextMenu={onContextMenu} {...listeners} {...attributes} style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none", visibility: isDragging ? "hidden" : "visible" }} className={`focus-ring w-full rounded-md border px-2 py-1.5 text-left text-xs font-semibold ${isDragging ? "border-coral bg-white shadow-lg" : "border-ink/10 bg-mist/40 hover:border-coral"}`}>{item.label}</button>;
}

function DroppableStep({ id, children }: { id: string; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id, data: { kind: "step", id } });
  return <div ref={setNodeRef} role="group" aria-label={`Form step ${Number(id.split(":").pop()) + 1} drop target`} className={`transition-all ${isOver ? "rounded-xl bg-coral/[0.04] ring-2 ring-inset ring-coral/20" : ""}`}>{children}</div>;
}

function FieldDropTarget({ id }: { id: string }) {
  const { setNodeRef } = useDroppable({ id, data: { kind: "field-target", id } });
  return <span ref={setNodeRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}

function DroppableLayoutItem({ id, children }: { id: string; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id, data: { kind: "layout-item", id } });
  return <div ref={setNodeRef} className={`rounded border p-2 transition-all ${isOver ? "border-coral border-dashed bg-coral/10 shadow-[0_0_0_4px_rgba(217,107,82,.12)]" : "border-ink/15 bg-white"}`}>{children}</div>;
}

function SortableOptionRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { kind: "option", id } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined }} className={`flex items-center gap-2 ${isDragging ? "scale-[1.01] rounded-lg bg-white shadow-xl ring-2 ring-coral/20" : ""}`}><span {...attributes} {...listeners} className="touch-none cursor-grab text-ink/40 active:cursor-grabbing" aria-label="Drag to reorder">☰</span>{children}</div>;
}

function SortableOptionList({ count, onMove, children }: { count: number; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleEnd = (event: DragEndEvent) => {
    const from = Number(String(event.active.id).split(":").pop());
    const to = Number(String(event.over?.id ?? "").split(":").pop());
    if (Number.isInteger(from) && Number.isInteger(to) && from !== to) onMove(from, to);
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}><SortableContext items={Array.from({ length: count }, (_, index) => `option:${index}`)} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>;
}

function BooleanSetting({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <fieldset className="grid gap-2"><legend className="text-sm">{label}</legend><div className="flex gap-4"><label className="flex items-center gap-2 text-sm font-normal"><input type="radio" name={id} checked={value} onChange={() => onChange(true)} />Yes</label><label className="flex items-center gap-2 text-sm font-normal"><input type="radio" name={id} checked={!value} onChange={() => onChange(false)} />No</label></div></fieldset>;
}

const formStyleChoices: { id: FormStyle; name: string; description: string; sample: string }[] = [
  { id: "modern-bold", name: "Modern bold", description: "High-contrast controls, strong labels, and confident calls to action.", sample: "Bold + high contrast" },
  { id: "modern-light", name: "Modern light", description: "Quiet borders, generous whitespace, and a calm editorial feel.", sample: "Light + spacious" },
  { id: "classic", name: "Classic", description: "Traditional labels, framed inputs, and dependable familiar controls.", sample: "Classic + framed" },
  { id: "bootstrap", name: "Bootstrap", description: "Compact, practical spacing and the familiar blue utility palette.", sample: "Utility + compact" },
  { id: "theme", name: "Inherit site theme", description: "Use the site’s current colors, typography, radii, and button language.", sample: "Site theme" },
  { id: "custom", name: "Custom", description: "Start with a polished base and tune the form’s color, density, and shape.", sample: "Your settings" }
];

function FormStylingPanel({ definition, setDefinition }: { definition: FormDefinition; setDefinition: (value: FormDefinition) => void }) {
  const settings = definition.styleSettings;
  const updateSettings = (changes: Partial<FormStyleSettings>) => setDefinition({ ...definition, styleSettings: { ...settings, ...changes } });
  const previewDefinition: FormDefinition = {
    ...definition,
    steps: [{
      id: "styling-preview-step",
      title: "A few quick details",
      description: "This live sample shows how your selected form style looks with common fields.",
      fields: [
        { id: "styling-preview-name", type: "text", name: "preview_name", label: "Your name", placeholder: "Jane Smith", required: true, settings: { columnSpan: 6 } },
        { id: "styling-preview-email", type: "email", name: "preview_email", label: "Email address", placeholder: "jane@example.com", required: true, settings: { columnSpan: 6 } },
        { id: "styling-preview-topic", type: "select", name: "preview_topic", label: "What can we help with?", options: [{ value: "worship", label: "Worship and services" }, { value: "community", label: "Community life" }, { value: "question", label: "A general question" }], settings: { columnSpan: 12 } },
        { id: "styling-preview-message", type: "textarea", name: "preview_message", label: "Message", placeholder: "Tell us a little more…", settings: { columnSpan: 12, rows: 4 } }
      ]
    }]
  };
  return <section className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-10" aria-label="Form styling">
    <div className="mx-auto grid w-full max-w-6xl gap-7">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">Presentation</p><h3 className="mt-2 font-serif text-3xl">Form styling</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">Choose a ready-made visual system for this form. Every style is mobile-first and adapts to the site’s responsive layout.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {formStyleChoices.map((choice) => <button key={choice.id} type="button" aria-pressed={definition.style === choice.id} onClick={() => setDefinition({ ...definition, style: choice.id })} className={`form-style-card focus-ring rounded-2xl border p-4 text-left transition ${definition.style === choice.id ? "border-coral bg-coral/5 shadow-md ring-2 ring-coral/15" : "border-ink/10 bg-white hover:-translate-y-0.5 hover:border-coral/50 hover:shadow-sm"}`}>
          <div className={`form-style-swatch form-style-swatch-${choice.id}`}><span>{choice.sample}</span><i /><i /><b /></div>
          <span className="mt-4 block font-semibold">{choice.name}</span><span className="mt-1 block text-sm leading-5 text-ink/60">{choice.description}</span>{definition.style === choice.id && <span className="mt-3 inline-flex rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-white">Selected</span>}
        </button>)}
      </div>
      <div className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <div><h4 className="font-semibold">Live preview</h4><p className="mt-1 text-sm leading-5 text-ink/60">Try the fields below. The preview updates immediately when you choose a different style.</p></div>
        <div className="rounded-xl border border-ink/10 bg-sand/40 p-4 sm:p-7"><FormRenderer formId="styling-preview" previewDefinition={{ id: "styling-preview", name: "Styling preview", definition: previewDefinition }} /></div>
      </div>
      {definition.style === "custom" && <div className="grid gap-5 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div className="sm:col-span-2"><h4 className="font-semibold">Custom form details</h4><p className="mt-1 text-sm text-ink/60">These controls affect the public form without changing the site-wide theme.</p></div>
        <label className="grid gap-1 text-sm font-semibold">Accent color<input type="color" className="h-11 w-full rounded-lg border border-ink/15 bg-white p-1" value={settings.accentColor} onChange={(event) => updateSettings({ accentColor: event.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Text color<input type="color" className="h-11 w-full rounded-lg border border-ink/15 bg-white p-1" value={settings.textColor} onChange={(event) => updateSettings({ textColor: event.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Surface color<input type="color" className="h-11 w-full rounded-lg border border-ink/15 bg-white p-1" value={settings.surfaceColor} onChange={(event) => updateSettings({ surfaceColor: event.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Border color<input type="color" className="h-11 w-full rounded-lg border border-ink/15 bg-white p-1" value={settings.borderColor} onChange={(event) => updateSettings({ borderColor: event.target.value })} /></label>
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Control shape</legend><div className="flex flex-wrap gap-3">{[["sharp", "Sharp"], ["soft", "Soft"], ["round", "Round"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-normal"><input type="radio" name="form-style-radius" checked={settings.radius === value} onChange={() => updateSettings({ radius: value as FormStyleSettings["radius"] })} />{label}</label>)}</div></fieldset>
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Spacing</legend><div className="flex flex-wrap gap-3">{[["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-normal"><input type="radio" name="form-style-density" checked={settings.density === value} onChange={() => updateSettings({ density: value as FormStyleSettings["density"] })} />{label}</label>)}</div></fieldset>
        <fieldset className="grid gap-2 sm:col-span-2"><legend className="text-sm font-semibold">Label weight</legend><div className="flex flex-wrap gap-3">{[["normal", "Normal"], ["semibold", "Semibold"], ["bold", "Bold"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-normal"><input type="radio" name="form-style-label-weight" checked={settings.labelWeight === value} onChange={() => updateSettings({ labelWeight: value as FormStyleSettings["labelWeight"] })} />{label}</label>)}</div></fieldset>
      </div>}
    </div>
  </section>;
}

function ConditionalFieldControl() {
  const context = useContext(ConditionalContext);
  if (!context) return null;
  const { field, allFields, update } = context;
  const settings = field.settings ?? {};
  const logic = String(settings.conditionLogic ?? "any");
  const candidates = allFields.filter((candidate) => candidate.id !== field.id && candidate.name);
  const validCondition = (condition: unknown): condition is FormCondition => Boolean(condition && typeof condition === "object" && !Array.isArray(condition) && typeof (condition as { field?: unknown }).field === "string" && ((condition as { operator?: unknown }).operator === "equals" || (condition as { operator?: unknown }).operator === "not-equals") && typeof (condition as { value?: unknown }).value === "string");
  const flatConditions = Array.isArray(settings.conditions) ? settings.conditions.filter(validCondition) : [];
  const groups = Array.isArray(settings.conditionGroups) ? settings.conditionGroups.map((group) => Array.isArray(group) ? group.filter(validCondition) : []).filter((group) => group.length) : flatConditions.length ? [flatConditions] : [];
  const updateSettings = (next: Record<string, unknown>) => update({ settings: { ...settings, ...next } });
  const blankCondition = (): FormCondition => ({ field: candidates[0]?.name ?? "", operator: "equals", value: "" });
  const renderCondition = (condition: FormCondition, index: number, groupIndex?: number) => <div key={`${field.id}-condition-${groupIndex ?? 0}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto] sm:items-center">
    <select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" aria-label={`Condition field ${index + 1}`} value={condition.field} onChange={(event) => { const next = groupIndex === undefined ? flatConditions : groups[groupIndex]; const updated = next.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value } : item); updateSettings(groupIndex === undefined ? { conditions: updated } : { conditionGroups: groups.map((group, itemIndex) => itemIndex === groupIndex ? updated : group) }); }}>{condition.field ? null : <option value="">Choose a field…</option>}{candidates.map((candidate) => <option key={candidate.id} value={candidate.name}>{candidate.label}</option>)}</select>
    <select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" aria-label={`Condition operator ${index + 1}`} value={condition.operator} onChange={(event) => { const next = groupIndex === undefined ? flatConditions : groups[groupIndex]; const updated = next.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as FormCondition["operator"] } : item); updateSettings(groupIndex === undefined ? { conditions: updated } : { conditionGroups: groups.map((group, itemIndex) => itemIndex === groupIndex ? updated : group) }); }}><option value="equals">Equal</option><option value="not-equals">Not equal</option></select>
    <input className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" aria-label={`Condition value ${index + 1}`} placeholder="Comparative value" value={condition.value} onChange={(event) => { const next = groupIndex === undefined ? flatConditions : groups[groupIndex]; const updated = next.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item); updateSettings(groupIndex === undefined ? { conditions: updated } : { conditionGroups: groups.map((group, itemIndex) => itemIndex === groupIndex ? updated : group) }); }} />
    <div className="flex gap-1 sm:justify-end"><button type="button" className="focus-ring rounded-full border border-coral px-2.5 py-1 text-lg leading-none text-coral" onClick={() => { if (groupIndex === undefined) updateSettings({ conditions: [...flatConditions, blankCondition()] }); else updateSettings({ conditionGroups: groups.map((group, itemIndex) => itemIndex === groupIndex ? [...group, blankCondition()] : group) }); }} aria-label="Add condition">+</button><button type="button" className="focus-ring rounded-full border border-ink/20 px-2.5 py-1 text-lg leading-none text-ink/60 disabled:opacity-30" disabled={(groupIndex === undefined ? flatConditions : groups[groupIndex]).length <= 1} onClick={() => { const next = groupIndex === undefined ? flatConditions : groups[groupIndex]; const updated = next.filter((_, itemIndex) => itemIndex !== index); updateSettings(groupIndex === undefined ? { conditions: updated } : { conditionGroups: groups.map((group, itemIndex) => itemIndex === groupIndex ? updated : group) }); }} aria-label="Remove condition">−</button></div>
  </div>;
  return <><BooleanSetting id={`${field.id}-conditional`} label="Conditional field" value={settings.conditional === true} onChange={(value) => update({ settings: { ...settings, conditional: value } })} /><div className="mt-3 grid gap-3 rounded-xl border border-coral/25 bg-coral/5 p-3" aria-label="Conditional field rules">
    <div><p className="text-sm font-semibold">Show this field when</p><p className="mt-1 text-xs leading-5 text-ink/55">Choose how the conditions below should be combined.</p></div>
    <fieldset className="grid gap-2"><legend className="sr-only">Condition matching</legend><div className="flex flex-wrap gap-4">{[["any", "Any"], ["all", "All"], ["group", "Group"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-normal"><input type="radio" name={`${field.id}-condition-logic`} checked={logic === value} onChange={() => updateSettings({ conditionLogic: value, ...(value === "group" && !groups.length ? { conditionGroups: [flatConditions.length ? flatConditions : [blankCondition()]] } : {}) })} />{label}</label>)}</div></fieldset>
    {logic === "group" ? <div className="grid gap-3">{(groups.length ? groups : [[blankCondition()]]).map((group, groupIndex) => <div key={`${field.id}-group-${groupIndex}`} className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/55">Condition group {groupIndex + 1}</p>{group.map((condition, index) => renderCondition(condition, index, groupIndex))}{groupIndex < groups.length - 1 && <div className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-coral">OR</div>}<div className="flex flex-wrap gap-2"><button type="button" className="focus-ring text-xs font-semibold text-coral underline" onClick={() => updateSettings({ conditionGroups: groups.map((item, itemIndex) => itemIndex === groupIndex ? [...item, blankCondition()] : item) })}>+ Add condition to group</button>{groupIndex === groups.length - 1 && <button type="button" className="focus-ring text-xs font-semibold text-coral underline" onClick={() => updateSettings({ conditionGroups: [...groups, [blankCondition()]] })}>+ Add OR group</button>}</div></div>)}</div> : <div className="grid gap-2">{flatConditions.length ? flatConditions.map((condition, index) => renderCondition(condition, index)) : <button type="button" className="focus-ring justify-self-start rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral disabled:opacity-40" disabled={!candidates.length} onClick={() => updateSettings({ conditions: [blankCondition()] })}>+ Add condition</button>}</div>}
  </div></>;
}

const dateFormats = [
  ["m/d/Y", "1/31/2026"], ["d/m/Y", "31/1/2026"], ["d.m.Y", "31.1.2026"], ["n/j/y", "1/31/26"],
  ["m/d/y", "01/31/26"], ["M/d/y", "Jan/31/26"], ["y/m/d", "26/01/31"], ["Y-m-d", "2026-01-31"],
  ["d-M-y", "31-Jan-26"], ["M/d/Y h:i K", "Jan/31/2026 09:30 AM"], ["m/d/Y H:i", "01/31/2026 09:30"],
  ["d/m/Y h:i K", "31/01/2026 09:30 AM"], ["d/m/Y H:i", "31/01/2026 09:30"],
  ["d.m.Y h:i K", "31.01.2026 09:30 AM"], ["d.m.Y H:i", "31.01.2026 09:30"],
  ["h:i K", "09:30 AM"], ["H:i", "09:30"]
] as const;
const predefinedSelectSets: Record<string, FormOption[]> = {
  Country: ["Afghanistan", "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China", "Colombia", "Costa Rica", "Croatia", "Cuba", "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt", "Finland", "France", "Germany", "Greece", "Guatemala", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Kenya", "Malaysia", "Mexico", "Morocco", "Netherlands", "New Zealand", "Nicaragua", "Nigeria", "Norway", "Pakistan", "Panama", "Peru", "Philippines", "Poland", "Portugal", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain", "Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Venezuela", "Vietnam"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "U.S. States": [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]].map(([value, label]) => ({ value, label })),
  "Canadian Provinces": [["ab", "Alberta"], ["bc", "British Columbia"], ["mb", "Manitoba"], ["nb", "New Brunswick"], ["nl", "Newfoundland and Labrador"], ["ns", "Nova Scotia"], ["on", "Ontario"], ["pe", "Prince Edward Island"], ["qc", "Quebec"], ["sk", "Saskatchewan"]].map(([value, label]) => ({ value, label })),
  Continents: ["Africa", "Antarctica", "Asia", "Europe", "North America", "South America", "Oceania"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  Gender: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }],
  Age: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, "-") })),
  "Marital Status": ["Single", "Married", "Separated", "Divorced", "Widowed"].map((label) => ({ label, value: label.toLowerCase() })),
  Employment: ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Retired", "Student"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Job Types": ["Administrative", "Customer service", "Finance", "Healthcare", "Information technology", "Management", "Marketing", "Sales", "Skilled trades", "Other"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  Industry: ["Agriculture", "Construction", "Education", "Government", "Healthcare", "Hospitality", "Manufacturing", "Nonprofit", "Professional services", "Retail", "Technology", "Transportation"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Education Level": ["Preschool", "Kindergarten", "Elementary school", "Middle school", "High school", "Vocational or trade school", "Some college", "Associate degree", "Bachelor's degree", "Master's degree", "Doctoral degree"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Days of the Week": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, index) => ({ label, value: String(index) })),
  "Months of the Year": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((label, index) => ({ label, value: String(index + 1) })),
  "How Often": ["Every day", "Several times a week", "Once a week", "Several times a month", "Once a month", "Less often", "Never"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "How Long": ["Less than a month", "1–6 months", "7–12 months", "1–2 years", "3–5 years", "More than 5 years"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, "-") })),
  "Satisfaction Levels": ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Importance Levels": ["Not important", "Slightly important", "Moderately important", "Very important", "Extremely important"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Agree/Disagree": ["Strongly agree", "Agree", "Somewhat agree", "Neither agree nor disagree", "Somewhat disagree", "Disagree", "Strongly disagree"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Comparison Levels": ["Much worse", "Worse", "About the same", "Better", "Much better"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Would You": ["Definitely", "Probably", "Might or might not", "Probably not", "Definitely not"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z]+/g, "-") })),
  "Size Levels": ["Extra small", "Small", "Medium", "Large", "Extra large", "2X-large", "3X-large"].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, "-") })),
  Timezones: ["Pacific", "Mountain", "Central", "Eastern", "Atlantic", "Alaska", "Hawaii"].map((label) => ({ label, value: label.toLowerCase() }))
};

export default function FormsPage() {
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [editing, setEditing] = useState<FormRecord | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [meta, setMeta] = useState(blank);
  const [definition, setDefinition] = useState(defaultFormDefinition());
  const [exportSettings, setExportSettings] = useState<FormExportSettings>(defaultFormDefinition().exportSettings);
  const [notifications, setNotifications] = useState<FormNotification[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submissionForm, setSubmissionForm] = useState<FormRecord | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  async function load() {
    const response = await fetch("/api/forms");
    if (response.ok) setForms(await response.json());
    else setMessage("Unable to load forms.");
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const id = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("form");
    if (id && forms.length && !editing) {
      const form = forms.find((item) => item.id === id);
      if (form) {
        openBuilder(form);
        window.history.replaceState({}, "", "/admin/forms");
      }
    }
  }, [forms, editing]);
  function closeBuilder() {
    setBuilderOpen(false);
    setEditing(null);
    setMessage("");
    if (typeof window !== "undefined" && window.location.search) window.history.replaceState({}, "", "/admin/forms");
  }
  function openBuilder(form?: FormRecord) {
    setEditing(form ?? null);
    setBuilderOpen(true);
    setMeta(form ? { name: form.name, slug: form.slug, status: form.status, enabled: form.enabled } : blank);
    setDefinition(form ? normalizeFormDefinition(form.definition) : defaultFormDefinition());
    setExportSettings(form?.exportSettings && typeof form.exportSettings === "object" ? { ...defaultFormDefinition().exportSettings, ...form.exportSettings, fieldOrder: Array.isArray(form.exportSettings.fieldOrder) ? form.exportSettings.fieldOrder.filter((value): value is string => typeof value === "string") : [] } : defaultFormDefinition().exportSettings);
    const settings = form?.notificationSettings ?? {};
    const stored = Array.isArray(settings.notifications) ? settings.notifications : [];
    const nextNotifications = stored.flatMap((value): FormNotification[] => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      return [{ ...blankNotification, id: typeof item.id === "string" ? item.id : makeFormId("notification"), name: typeof item.name === "string" && item.name ? item.name : blankNotification.name, enabled: item.enabled !== false, recipientMode: item.recipientMode === "field" ? "field" : "email", recipients: typeof item.recipients === "string" ? item.recipients : Array.isArray(item.recipients) ? item.recipients.filter((recipient): recipient is string => typeof recipient === "string").join(", ") : "", recipientField: typeof item.recipientField === "string" ? item.recipientField : "", subject: typeof item.subject === "string" && item.subject ? item.subject : blankNotification.subject, body: typeof item.body === "string" ? item.body : blankNotification.body, format: item.format === "text" ? "text" : "html", attachPdf: item.attachPdf !== false, attachmentUrl: typeof item.attachmentUrl === "string" ? item.attachmentUrl : "", attachmentName: typeof item.attachmentName === "string" ? item.attachmentName : "", fromName: typeof item.fromName === "string" ? item.fromName : "", fromEmail: typeof item.fromEmail === "string" ? item.fromEmail : "", replyTo: typeof item.replyTo === "string" ? item.replyTo : "", bcc: typeof item.bcc === "string" ? item.bcc : "", cc: typeof item.cc === "string" ? item.cc : "" }];
    });
    if (nextNotifications.length) setNotifications(nextNotifications);
    else if (typeof settings.subject === "string" || settings.enabled === true) setNotifications([{ ...blankNotification, id: makeFormId("notification"), enabled: settings.enabled === true, recipients: Array.isArray(settings.recipients) ? settings.recipients.filter((value): value is string => typeof value === "string").join(", ") : typeof settings.recipients === "string" ? settings.recipients : "", subject: typeof settings.subject === "string" && settings.subject ? settings.subject : blankNotification.subject, attachPdf: settings.attachPdf !== false }]);
    else setNotifications([]);
    setMessage("");
  }
  async function saveForm() {
    if (!meta.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)) { setMessage("Use a name and a lowercase slug (for example, contact-us)."); return; }
    const response = await fetch(editing ? `/api/forms/${editing.id}` : "/api/forms", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...meta, definition, notificationSettings: { notifications: notifications.map((item) => ({ ...item, recipients: item.recipients.split(/[,\n]/).map((value) => value.trim()).filter(Boolean) })) }, exportSettings }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error ?? "Unable to save form."); return; }
    if (!editing && result && typeof result.id === "string") setEditing(result as FormRecord);
    setMessage("Form saved.");
    await load();
  }
  async function remove(form: FormRecord) {
    if (!window.confirm(`Delete “${form.name}” and its submissions?`)) return;
    const response = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    if (response.ok) await load(); else setMessage("Unable to delete form.");
  }
  async function viewSubmissions(form: FormRecord) {
    const response = await fetch(`/api/forms/${form.id}/submissions`);
    if (!response.ok) { setMessage("You do not have permission to view submissions."); return; }
    setSubmissions(await response.json()); setSubmissionForm(form);
  }
  return <main><Container className="py-10 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Content</p><h1 className="mt-2 font-serif text-4xl">Forms</h1><p className="mt-2 text-ink/60">Create reusable forms once, then place them in any page.</p></div><button type="button" className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" onClick={() => openBuilder()}>Create form</button></div><div className="mt-8 grid gap-4">{loading ? <Card>Loading forms…</Card> : forms.length === 0 ? <Card><p className="text-ink/60">No forms yet. Create your first form to make it available to the page builder.</p></Card> : forms.map((form) => <Card key={form.id} className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl">{form.name}</h2><p className="mt-1 text-sm text-ink/55">{form.slug} · {form.status.toLowerCase()} · {form._count?.submissions ?? 0} submissions</p></div><div className="flex flex-wrap gap-3"><button type="button" className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold" onClick={() => void viewSubmissions(form)}>Submissions</button><a className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold" href={`/api/forms/${form.id}/submissions/export`}>Export CSV</a><button type="button" className="focus-ring text-sm font-semibold text-coral" onClick={() => openBuilder(form)}>Edit</button><button type="button" className="focus-ring text-sm font-semibold text-ink/60" onClick={() => void remove(form)}>Delete</button></div></Card>)}</div></Container>{submissionForm && <SubmissionModal form={submissionForm} submissions={submissions} onClose={() => setSubmissionForm(null)} />}{builderOpen && <BuilderModal meta={meta} setMeta={setMeta} definition={definition} setDefinition={setDefinition} exportSettings={exportSettings} setExportSettings={setExportSettings} notifications={notifications} setNotifications={setNotifications} message={message} onSave={() => void saveForm()} onCancel={closeBuilder} />}</main>;
}

function SubmissionModal({ form, submissions, onClose }: { form: FormRecord; submissions: SubmissionRecord[]; onClose: () => void }) {
  const settings = form.exportSettings ?? {};
  const definition = normalizeFormDefinition(form.definition);
  const allFields = definition.steps.flatMap((step) => step.fields).filter((field) => !["section-break", "button", "custom-html"].includes(field.type));
  const order = Array.isArray(settings.fieldOrder) ? settings.fieldOrder.filter((value): value is string => typeof value === "string") : [];
  const fields = order.length ? [...order.map((name) => allFields.find((field) => field.name === name)).filter((field): field is typeof allFields[number] => Boolean(field)), ...allFields.filter((field) => !order.includes(field.name))] : allFields;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submissions-title"><div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><div><h2 id="submissions-title" className="font-serif text-2xl">{form.name} submissions</h2><p className="text-sm text-ink/55">{submissions.length} recent submissions</p></div><button type="button" className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold" onClick={onClose}>Close</button></header><div className="max-h-[75vh] overflow-auto p-5">{submissions.length === 0 ? <p className="text-sm text-ink/55">No submissions yet.</p> : <table className="min-w-full border-collapse text-left text-sm"><thead><tr>{settings.includeMetadata !== false && <th className="border-b border-ink/10 px-3 py-2">Submitted</th>}{fields.map((field) => <th key={field.id} className="border-b border-ink/10 px-3 py-2">{field.label}</th>)}<th className="border-b border-ink/10 px-3 py-2">PDF</th></tr></thead><tbody>{submissions.map((submission) => <tr key={submission.id}>{settings.includeMetadata !== false && <td className="border-b border-ink/10 px-3 py-2 whitespace-nowrap">{new Date(submission.createdAt).toLocaleString()}</td>}{fields.map((field) => { const value = submission.values[field.name]; return <td key={field.id} className="max-w-xs border-b border-ink/10 px-3 py-2">{Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}</td>; })}<td className="border-b border-ink/10 px-3 py-2"><a className="text-coral underline" href={`/api/forms/${form.id}/submissions/${submission.id}/pdf`}>Download</a></td></tr>)}</tbody></table>}</div></div></div>;
}

function NotificationSettings({ notifications, setNotifications, fields }: { notifications: FormNotification[]; setNotifications: (value: FormNotification[]) => void; fields: FormField[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = notifications.find((item) => item.id === editingId) ?? null;
  const update = (changes: Partial<FormNotification>) => {
    if (!editing) return;
    setNotifications(notifications.map((item) => item.id === editing.id ? { ...item, ...changes } : item));
  };
  const add = () => {
    const item = { ...blankNotification, id: makeFormId("notification"), name: `Notification ${notifications.length + 1}` };
    setNotifications([...notifications, item]);
    setEditingId(item.id);
  };
  const fieldOptions = fields.filter((field) => field.name && !["button", "section-break", "custom-html"].includes(field.type));
  const allFieldsShortcode = fieldOptions.map((field) => `${field.label}: {${field.name}}`).join("<br>");
  return <div className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">Email notifications</h4><p className="mt-1 text-sm text-ink/60">Create one or more messages for each new submission.</p></div><button type="button" className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white" onClick={add}>Add notification</button></div>
    {notifications.length === 0 ? <p className="rounded-lg border border-dashed border-ink/20 p-5 text-sm text-ink/55">No notifications configured.</p> : <div className="overflow-x-auto rounded-xl border border-ink/10"><table className="min-w-full text-left text-sm"><thead className="bg-mist/30 text-xs uppercase tracking-wider text-ink/55"><tr><th className="px-3 py-3">Enabled</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody>{notifications.map((item) => <tr key={item.id} className="border-t border-ink/10"><td className="px-3 py-3"><input type="checkbox" aria-label={`Enable ${item.name}`} checked={item.enabled} onChange={(event) => setNotifications(notifications.map((current) => current.id === item.id ? { ...current, enabled: event.target.checked } : current))} /></td><td className="px-3 py-3 font-semibold">{item.name}</td><td className="px-3 py-3 text-ink/65">{item.subject}</td><td className="px-3 py-3 text-right"><button type="button" className="focus-ring mr-3 font-semibold text-coral" onClick={() => setEditingId(item.id)}>Settings</button><button type="button" className="focus-ring font-semibold text-ink/55" onClick={() => { setNotifications(notifications.filter((current) => current.id !== item.id)); if (editingId === item.id) setEditingId(null); }}>Delete</button></td></tr>)}</tbody></table></div>}
    {editing && <div className="grid gap-4 rounded-xl border border-coral/25 bg-coral/5 p-4" aria-label={`${editing.name} notification settings`}><div className="flex items-center justify-between gap-3"><h5 className="font-semibold">Notification settings</h5><button type="button" className="focus-ring text-sm font-semibold text-coral" onClick={() => setEditingId(null)}>Done</button></div><label className="grid gap-1 text-sm font-semibold">Name<input className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" value={editing.name} onChange={(event) => update({ name: event.target.value })} /></label><fieldset className="grid gap-2"><legend className="text-sm font-semibold">Sent To</legend><div className="flex flex-wrap gap-4">{[["email", "Enter Email"], ["field", "Select a Field"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-normal"><input type="radio" name={`${editing.id}-recipient-mode`} checked={editing.recipientMode === value} onChange={() => update({ recipientMode: value as FormNotification["recipientMode"] })} />{label}</label>)}</div></fieldset>{editing.recipientMode === "email" ? <label className="grid gap-1 text-sm font-semibold">Recipient email<textarea rows={2} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" placeholder="office@example.com" value={editing.recipients} onChange={(event) => update({ recipients: event.target.value })} /><span className="text-xs font-normal text-ink/55">Separate addresses with commas or new lines.</span></label> : <label className="grid gap-1 text-sm font-semibold">Recipient field<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" value={editing.recipientField} onChange={(event) => update({ recipientField: event.target.value })}><option value="">Choose a field…</option>{fieldOptions.map((field) => <option key={field.id} value={field.name}>{field.label}</option>)}</select></label>}<label className="grid gap-1 text-sm font-semibold">Subject<input className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" value={editing.subject} onChange={(event) => update({ subject: event.target.value })} /></label><div className="grid gap-2"><span className="text-sm font-semibold">Email body</span><RichTextField value={editing.body} onChange={(value) => update({ body: value })} toolbarExtras={(insertHtml) =>     <select aria-label="Add shortcode" className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs" defaultValue="" onChange={(event) => { const value = event.target.value; if (value === "__all_fields__") insertHtml(allFieldsShortcode); else if (value) insertHtml(`{${value}}`); event.currentTarget.value = ""; }}>    <option value="">Add shortcodes</option><option value="__all_fields__">All form fields</option>{fieldOptions.map((field) => <option key={field.id} value={field.name}>{field.label}</option>)}</select>} /></div><fieldset className="grid gap-2"><legend className="text-sm font-semibold">Email format</legend><div className="flex gap-4">{[["html", "HTML"], ["text", "Plain text"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm font-normal"><input type="radio" name={`${editing.id}-format`} checked={editing.format === value} onChange={() => update({ format: value as FormNotification["format"] })} />{label}</label>)}</div></fieldset><div className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><BooleanSetting id={`${editing.id}-attach-pdf`} label="Attach submission PDF" value={editing.attachPdf} onChange={(value) => update({ attachPdf: value })} /><div className="text-xs font-semibold text-ink/55">Additional attachment</div>    <MediaPicker label="Choose a file" mediaType="document" value={editing.attachmentUrl || undefined} onSelect={(asset) => update({ attachmentUrl: asset.url, attachmentName: asset.originalName })} />{editing.attachmentUrl && <p className="truncate text-xs text-ink/55">{editing.attachmentName || editing.attachmentUrl}</p>}</div><details className="rounded-lg border border-ink/10 bg-white p-3"><summary className="cursor-pointer font-semibold">Advanced settings</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">From name<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={editing.fromName} onChange={(event) => update({ fromName: event.target.value })} /></label><label className="grid gap-1 text-sm">From email<input type="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={editing.fromEmail} onChange={(event) => update({ fromEmail: event.target.value })} /></label><label className="grid gap-1 text-sm">Reply To<input type="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={editing.replyTo} onChange={(event) => update({ replyTo: event.target.value })} /></label><label className="grid gap-1 text-sm">BCC<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={editing.bcc} onChange={(event) => update({ bcc: event.target.value })} /></label><label className="grid gap-1 text-sm sm:col-span-2">CC<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={editing.cc} onChange={(event) => update({ cc: event.target.value })} /></label></div></details></div>}
  </div>;
}

function BuilderModal({ meta, setMeta, definition, setDefinition, exportSettings, setExportSettings, notifications, setNotifications, message, onSave, onCancel }: { meta: typeof blank; setMeta: (value: typeof blank) => void; definition: FormDefinition; setDefinition: (value: FormDefinition) => void; exportSettings: FormExportSettings; setExportSettings: (value: FormExportSettings) => void; notifications: FormNotification[]; setNotifications: (value: FormNotification[]) => void; message: string; onSave: () => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<{ step: number; field: number; column?: number; layoutItem?: number; nestedField?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selection: { step: number; field: number; column?: number; layoutItem?: number; nestedField?: number } } | null>(null);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ left: number; top: number } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [activePanel, setActivePanel] = useState<"editor" | "settings" | "styling">("editor");
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu]);
  const parentField = selected ? definition.steps[selected.step]?.fields[selected.field] : null;
  const field = parentField && selected?.column !== undefined && selected.nestedField !== undefined
    ? columnFields(parentField)[selected.column]?.[selected.nestedField] ?? null
    : parentField && selected?.layoutItem !== undefined && selected.nestedField !== undefined
      ? layoutItems(parentField)[selected.layoutItem]?.fields[selected.nestedField] ?? null
      : parentField;
  const openFieldContextMenu = (event: ReactMouseEvent<HTMLElement>, selection: { step: number; field: number; column?: number; layoutItem?: number; nestedField?: number }) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(selection);
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 160), y: Math.min(event.clientY, window.innerHeight - 80), selection });
  };
  const activeCanvasField = activeCanvasId ? definition.steps.flatMap((step) => step.fields).find((item) => `canvas:${item.id}` === activeCanvasId) : null;
  const updateSteps = (steps: FormDefinition["steps"]) => setDefinition({ ...definition, steps });
  const addField = (type: FormFieldType, stepIndex = definition.steps.length - 1, insertIndex?: number) => {
    const field: FormField = { id: makeFormId("field"), type, name: `field_${Date.now()}`, label: formFieldTypeLabel(type), required: false, options: ["select", "radio", "ranking"].includes(type) ? [{ value: "option-1", label: "Option 1" }, { value: "option-2", label: "Option 2" }] : undefined, settings: type === "custom-html" ? { html: "<p>Add your content here.</p>" } : type === "terms" ? { columnSpan: 12, showCheckbox: true, includeTerms: true, termsHtml: "<h2>Terms and Conditions</h2><p>Add your terms and conditions here.</p>", includePrivacy: true, privacyHtml: "<h2>Privacy Policy</h2><p>Add your privacy policy here.</p>" } : type === "button" ? { columnSpan: 12, buttonType: "submit", buttonStyle: "coral", buttonSize: "medium", buttonAlignment: "left", action: "url", target: "_self" } : { columnSpan: 12 } };
    const steps = definition.steps.map((step, index) => {
      if (index !== stepIndex) return step;
      const fields = [...step.fields];
      const target = typeof insertIndex === "number" ? Math.max(0, Math.min(fields.length, insertIndex)) : fields.length;
      fields.splice(target, 0, field);
      return { ...step, fields };
    });
    updateSteps(steps); setSelected({ step: stepIndex, field: typeof insertIndex === "number" ? insertIndex : steps[stepIndex].fields.length - 1 });
  };
  const addGroup = (groupId: string, stepIndex = definition.steps.length - 1, insertIndex?: number) => {
    const group = formFieldGroups.find((item) => item.id === groupId);
    if (!group) return;
    const type = groupId === "address" ? "address" : "name";
    const field: FormField = { id: makeFormId("group"), type, name: `${type}_${Date.now()}`, label: group.label, required: false, settings: defaultGroupSettings(type) };
    const steps = definition.steps.map((step, index) => {
      if (index !== stepIndex) return step;
      const fields = [...step.fields];
      const target = typeof insertIndex === "number" ? Math.max(0, Math.min(fields.length, insertIndex)) : fields.length;
      fields.splice(target, 0, field);
      return { ...step, fields };
    });
    updateSteps(steps); setSelected({ step: stepIndex, field: typeof insertIndex === "number" ? insertIndex : steps[stepIndex].fields.length - 1 });
  };
  const addContainer = (columns: number, stepIndex = definition.steps.length - 1, insertIndex?: number) => {
    const field: FormField = { id: makeFormId("container"), type: "section-break", name: `container_${Date.now()}`, label: `${columns}-column container`, settings: { layout: "columns", columns, columnSpan: 12, columnWidths: Array.from({ length: columns }, () => columns === 1 ? 12 : 1) } };
    const steps = definition.steps.map((step, index) => {
      if (index !== stepIndex) return step;
      const fields = [...step.fields];
      const target = typeof insertIndex === "number" ? Math.max(0, Math.min(fields.length, insertIndex)) : fields.length;
      fields.splice(target, 0, field);
      return { ...step, fields };
    });
    updateSteps(steps); setSelected({ step: stepIndex, field: typeof insertIndex === "number" ? insertIndex : steps[stepIndex].fields.length - 1 });
  };
  const addLayout = (layout: "accordion" | "tabs", stepIndex = definition.steps.length - 1, insertIndex?: number) => {
    const field: FormField = { id: makeFormId(layout), type: "section-break", name: `${layout}_${Date.now()}`, label: layout === "accordion" ? "Accordion" : "Tabs", settings: { layout, columns: 1, items: [{ id: makeFormId("item"), title: layout === "accordion" ? "Panel 1" : "Tab 1", fields: [] }, { id: makeFormId("item"), title: layout === "accordion" ? "Panel 2" : "Tab 2", fields: [] }] } };
    const steps = definition.steps.map((step, index) => {
      if (index !== stepIndex) return step;
      const fields = [...step.fields];
      const target = typeof insertIndex === "number" ? Math.max(0, Math.min(fields.length, insertIndex)) : fields.length;
      fields.splice(target, 0, field);
      return { ...step, fields };
    });
    updateSteps(steps); setSelected({ step: stepIndex, field: typeof insertIndex === "number" ? insertIndex : steps[stepIndex].fields.length - 1 });
  };
  const addFieldToLayout = (stepIndex: number, fieldIndex: number, itemIndex: number, type: FormFieldType) => {
    const field: FormField = { id: makeFormId("field"), type, name: `field_${Date.now()}`, label: formFieldTypeLabel(type), required: false, options: ["select", "radio", "ranking"].includes(type) ? [{ value: "option-1", label: "Option 1" }, { value: "option-2", label: "Option 2" }] : undefined, settings: type === "custom-html" ? { html: "<p>Add your content here.</p>" } : type === "terms" ? { columnSpan: 12, showCheckbox: true, includeTerms: true, termsHtml: "<h2>Terms and Conditions</h2><p>Add your terms and conditions here.</p>", includePrivacy: true, privacyHtml: "<h2>Privacy Policy</h2><p>Add your privacy policy here.</p>" } : type === "button" ? { columnSpan: 12, buttonType: "submit", buttonStyle: "coral", buttonSize: "medium", buttonAlignment: "left", action: "url", target: "_self" } : { columnSpan: 12 } };
    const steps = definition.steps.map((step, currentStep) => currentStep !== stepIndex ? step : { ...step, fields: step.fields.map((item, currentField) => currentField !== fieldIndex ? item : { ...item, settings: { ...item.settings, items: layoutItems(item).map((layoutItem, currentItem) => currentItem === itemIndex ? { ...layoutItem, fields: [...layoutItem.fields, field] } : layoutItem) } }) });
    updateSteps(steps);
  };
  const addFieldToColumn = (stepIndex: number, fieldIndex: number, columnIndex: number, type: FormFieldType) => {
    const field: FormField = { id: makeFormId("field"), type, name: `field_${Date.now()}`, label: formFieldTypeLabel(type), required: false, options: ["select", "radio", "ranking"].includes(type) ? [{ value: "option-1", label: "Option 1" }, { value: "option-2", label: "Option 2" }] : undefined, settings: { columnSpan: 12 } };
    const steps = definition.steps.map((step, currentStep) => {
      if (currentStep !== stepIndex) return step;
      return {
        ...step,
        fields: step.fields.map((item, currentField) => {
          if (currentField !== fieldIndex) return item;
          const columns = columnFields(item);
          columns[columnIndex] = [...columns[columnIndex], field];
          return { ...item, settings: { ...item.settings, columnFields: columns } };
        })
      };
    });
    updateSteps(steps);
  };
  const moveField = (fromStep: number, fromIndex: number, toStep: number, toIndex: number) => {
    if (fromStep === toStep) {
      if (fromIndex === toIndex) return;
      updateSteps(definition.steps.map((step, index) => index === fromStep ? { ...step, fields: arrayMove(step.fields, fromIndex, toIndex) } : step));
      setSelected({ step: toStep, field: toIndex });
      return;
    }
    const moving = definition.steps[fromStep]?.fields[fromIndex];
    if (!moving || toIndex < 0 || toIndex > (definition.steps[toStep]?.fields.length ?? 0)) return;
    const steps = definition.steps.map((step, index) => {
      if (index === fromStep) return { ...step, fields: step.fields.filter((_, fieldIndex) => fieldIndex !== fromIndex) };
      if (index === toStep) {
        const fields = [...step.fields];
        fields.splice(toIndex, 0, moving);
        return { ...step, fields };
      }
      return step;
    });
    updateSteps(steps);
    setSelected({ step: toStep, field: toIndex });
  };
  const updateField = (changes: Partial<FormField>) => {
    if (!selected) return;
    updateSteps(definition.steps.map((step, index) => index !== selected.step ? step : {
      ...step,
      fields: step.fields.map((item, fieldIndex) => {
        if (fieldIndex !== selected.field) return item;
        if (selected.column !== undefined && selected.nestedField !== undefined) {
          const columns = columnFields(item);
          columns[selected.column] = columns[selected.column].map((nested, nestedIndex) => nestedIndex === selected.nestedField ? { ...nested, ...changes } : nested);
          return { ...item, settings: { ...item.settings, columnFields: columns } };
        }
        if (selected.layoutItem !== undefined && selected.nestedField !== undefined) {
          const items = layoutItems(item);
          items[selected.layoutItem] = { ...items[selected.layoutItem], fields: items[selected.layoutItem].fields.map((nested, nestedIndex) => nestedIndex === selected.nestedField ? { ...nested, ...changes } : nested) };
          return { ...item, settings: { ...item.settings, items } };
        }
        return { ...item, ...changes };
      })
    }));
  };
  const removeField = () => {
    if (!selected) return;
    updateSteps(definition.steps.map((step, index) => index !== selected.step ? step : {
      ...step,
      fields: step.fields.flatMap((item, fieldIndex) => {
        if (fieldIndex !== selected.field) return [item];
        if (selected.column !== undefined && selected.nestedField !== undefined) {
          const columns = columnFields(item);
          columns[selected.column] = columns[selected.column].filter((_, nestedIndex) => nestedIndex !== selected.nestedField);
          return [{ ...item, settings: { ...item.settings, columnFields: columns } }];
        }
        if (selected.layoutItem !== undefined && selected.nestedField !== undefined) {
          const items = layoutItems(item);
          items[selected.layoutItem] = { ...items[selected.layoutItem], fields: items[selected.layoutItem].fields.filter((_, nestedIndex) => nestedIndex !== selected.nestedField) };
          return [{ ...item, settings: { ...item.settings, items } }];
        }
        return [];
      })
    })); setSelected(null);
  };
  const addStep = () => { const steps = [...definition.steps, { id: makeFormId("step"), title: `Step ${definition.steps.length + 1}`, fields: [] }]; updateSteps(steps); setSelected({ step: steps.length - 1, field: 0 }); };
  const moveFieldToColumn = (source: { kind: "canvas-field" | "column-field"; id: string; stepIndex?: number; fieldIndex?: number; containerId?: string; columnIndex?: number }, containerId: string, columnIndex: number, targetFieldId?: string) => {
    const steps = definition.steps.map((step) => ({
      ...step,
      fields: step.fields.map((item) => item.settings?.layout === "columns" ? { ...item, settings: { ...item.settings, columnFields: columnFields(item).map((column) => [...column]) } } : item)
    }));
    let moving: FormField | undefined;
    if (source.kind === "canvas-field" && source.stepIndex !== undefined && source.fieldIndex !== undefined) {
      moving = steps[source.stepIndex]?.fields.splice(source.fieldIndex, 1)[0];
    } else if (source.kind === "column-field" && source.containerId && source.columnIndex !== undefined) {
      const sourceContainer = steps.flatMap((step) => step.fields).find((item) => item.id === source.containerId);
      if (sourceContainer) {
        const columns = columnFields(sourceContainer);
        const sourceIndex = columns[source.columnIndex].findIndex((item) => item.id === source.id);
        if (sourceIndex >= 0) {
          moving = columns[source.columnIndex].splice(sourceIndex, 1)[0];
          sourceContainer.settings = { ...sourceContainer.settings, columnFields: columns };
        }
      }
    }
    const destination = steps.flatMap((step) => step.fields).find((item) => item.id === containerId);
    if (!moving || !destination) return;
    const columns = columnFields(destination);
    const foundTargetIndex = targetFieldId ? columns[columnIndex].findIndex((item) => item.id === targetFieldId) : -1;
    const targetIndex = foundTargetIndex >= 0 ? foundTargetIndex : columns[columnIndex].length;
    columns[columnIndex].splice(targetIndex, 0, moving);
    destination.settings = { ...destination.settings, columnFields: columns };
    updateSteps(steps);
    const destinationLocation = steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === containerId);
    if (destinationLocation) setSelected({ step: destinationLocation.stepIndex, field: destinationLocation.fieldIndex, column: columnIndex, nestedField: columns[columnIndex].indexOf(moving) });
  };
  const moveFieldToLayout = (source: { id: string; layoutId: string; itemIndex: number }, layoutId: string, itemIndex: number, targetFieldId?: string) => {
    const steps = definition.steps.map((step) => ({
      ...step,
      fields: step.fields.map((item) => item.id === source.layoutId || item.id === layoutId
        ? { ...item, settings: { ...item.settings, items: layoutItems(item).map((layoutItem) => ({ ...layoutItem, fields: [...layoutItem.fields] })) } }
        : item)
    }));
    let moving: FormField | undefined;
    const sourceLayout = steps.flatMap((step) => step.fields).find((item) => item.id === source.layoutId);
    if (sourceLayout) {
      const sourceItems = layoutItems(sourceLayout);
      const sourceFields = sourceItems[source.itemIndex]?.fields;
      const sourceIndex = sourceFields?.findIndex((item) => item.id === source.id) ?? -1;
      if (sourceFields && sourceIndex >= 0) {
        moving = sourceFields.splice(sourceIndex, 1)[0];
        sourceLayout.settings = { ...sourceLayout.settings, items: sourceItems };
      }
    }
    const destination = steps.flatMap((step) => step.fields).find((item) => item.id === layoutId);
    if (!moving || !destination) return;
    const destinationItems = layoutItems(destination);
    const destinationFields = destinationItems[itemIndex]?.fields;
    if (!destinationFields) return;
    const foundTargetIndex = targetFieldId ? destinationFields.findIndex((item) => item.id === targetFieldId) : -1;
    destinationFields.splice(foundTargetIndex >= 0 ? foundTargetIndex : destinationFields.length, 0, moving);
    destination.settings = { ...destination.settings, items: destinationItems };
    updateSteps(steps);
    const destinationLocation = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === layoutId);
    if (destinationLocation) setSelected({ step: destinationLocation.stepIndex, field: destinationLocation.fieldIndex, layoutItem: itemIndex, nestedField: destinationFields.indexOf(moving) });
  };
  const handleDndEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as { kind?: string; type?: FormFieldType; groupId?: string; container?: string; id?: string; fieldId?: string; containerId?: string; columnIndex?: number; layoutId?: string; itemIndex?: number } | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";
    if (data?.kind === "canvas-field" && data.id) {
      const from = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === data.id);
      const targetId = overId.replace(/^(?:field|canvas):/, "");
      const to = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === targetId);
      const columnTarget = /^column:([^:]+):(\d+)$/.exec(overId);
      const columnFieldTarget = /^column-field:([^:]+):(\d+):(.+)$/.exec(overId);
      if (columnTarget) moveFieldToColumn({ kind: "canvas-field", id: data.id, stepIndex: from?.stepIndex, fieldIndex: from?.fieldIndex }, columnTarget[1], Number(columnTarget[2]));
      else if (columnFieldTarget) moveFieldToColumn({ kind: "canvas-field", id: data.id, stepIndex: from?.stepIndex, fieldIndex: from?.fieldIndex }, columnFieldTarget[1], Number(columnFieldTarget[2]), columnFieldTarget[3]);
      else if (from && to) moveField(from.stepIndex, from.fieldIndex, to.stepIndex, to.fieldIndex);
      else {
        const stepMatch = /^step:(\d+)$/.exec(overId);
        if (from && stepMatch) moveField(from.stepIndex, from.fieldIndex, Number(stepMatch[1]), definition.steps[Number(stepMatch[1])]?.fields.length ?? 0);
      }
      return;
    }
    if (data?.kind === "layout-field" && data.fieldId && data.layoutId !== undefined && data.itemIndex !== undefined) {
      const layoutTarget = /^layout:([^:]+):(\d+)$/.exec(overId);
      const layoutFieldTarget = /^layout-field:([^:]+):(\d+):(.+)$/.exec(overId);
      if (layoutTarget) moveFieldToLayout({ id: data.fieldId, layoutId: data.layoutId, itemIndex: data.itemIndex }, layoutTarget[1], Number(layoutTarget[2]));
      else if (layoutFieldTarget) moveFieldToLayout({ id: data.fieldId, layoutId: data.layoutId, itemIndex: data.itemIndex }, layoutFieldTarget[1], Number(layoutFieldTarget[2]), layoutFieldTarget[3]);
      return;
    }
    if (data?.kind === "column-field" && data.fieldId && data.containerId !== undefined && data.columnIndex !== undefined) {
      const columnTarget = /^column:([^:]+):(\d+)$/.exec(overId);
      const columnFieldTarget = /^column-field:([^:]+):(\d+):(.+)$/.exec(overId);
      if (columnTarget) moveFieldToColumn({ kind: "column-field", id: data.fieldId, containerId: data.containerId, columnIndex: data.columnIndex }, columnTarget[1], Number(columnTarget[2]));
      else if (columnFieldTarget) moveFieldToColumn({ kind: "column-field", id: data.fieldId, containerId: data.containerId, columnIndex: data.columnIndex }, columnFieldTarget[1], Number(columnFieldTarget[2]), columnFieldTarget[3]);
      return;
    }
    if (data?.kind === "palette" && data.type && overId.startsWith("layout:")) {
      const match = /^layout:([^:]+):(\d+)$/.exec(overId);
      if (match) {
        const location = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === match[1]);
        if (location) addFieldToLayout(location.stepIndex, location.fieldIndex, Number(match[2]), data.type);
      }
      return;
    }
    if (data?.kind === "palette-container" && data.container) {
      const columnsMatch = /^columns:(\d+)$/.exec(data.container);
      const layout = data.container === "accordion" || data.container === "tabs" ? data.container : null;
      const fieldMatch = /^field:(.+)$/.exec(overId);
      const location = fieldMatch ? definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === fieldMatch[1]) : null;
      if (columnsMatch) addContainer(Number(columnsMatch[1]), location?.stepIndex ?? definition.steps.length - 1, location?.fieldIndex);
      else if (layout) addLayout(layout, location?.stepIndex ?? definition.steps.length - 1, location?.fieldIndex);
    }
    if (data?.kind === "palette-group" && data.groupId) {
      let handled = false;
      const stepMatch = /^step:(\d+)$/.exec(overId);
      if (stepMatch) {
        addGroup(data.groupId, Number(stepMatch[1]));
        handled = true;
      }
      const fieldMatch = /^field:(.+)$/.exec(overId);
      if (fieldMatch) {
        const location = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === fieldMatch[1]);
        if (location) {
          addGroup(data.groupId, location.stepIndex, location.fieldIndex);
          handled = true;
        }
      }
      if (!handled && definition.steps.length) addGroup(data.groupId, definition.steps.length - 1);
    }
    if (data?.kind === "palette" && data.type) {
      let handled = false;
      const columnMatch = /^column:([^:]+):(\d+)$/.exec(overId);
      if (columnMatch) {
        const location = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === columnMatch[1]);
        if (location) {
          addFieldToColumn(location.stepIndex, location.fieldIndex, Number(columnMatch[2]), data.type);
          handled = true;
        }
      }
      else {
        const stepMatch = /^step:(\d+)$/.exec(overId);
        if (stepMatch) {
          addField(data.type, Number(stepMatch[1]));
          handled = true;
        }
        const fieldMatch = /^field:(.+)$/.exec(overId);
        if (fieldMatch) {
          const location = definition.steps.flatMap((step, stepIndex) => step.fields.map((item, fieldIndex) => ({ item, stepIndex, fieldIndex }))).find((entry) => entry.item.id === fieldMatch[1]);
          if (location) {
            addField(data.type, location.stepIndex, location.fieldIndex);
            handled = true;
          }
        }
      }
      if (!handled && definition.steps.length) addField(data.type, definition.steps.length - 1);
    }
  };
  return <div className="fixed inset-0 z-[100] flex flex-col bg-sand" role="dialog" aria-modal="true" aria-labelledby="form-builder-title">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-white px-5 py-4"><div><h2 id="form-builder-title" className="font-serif text-2xl">{meta.name || "New form"}</h2><p className="text-sm text-ink/55">Full form builder</p></div><div className="flex flex-wrap items-center justify-end gap-2"><span role="status" className={`text-sm font-semibold ${message.includes("saved") ? "text-emerald-700" : "text-coral"}`}>{message}</span><button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={onCancel}>Back to forms</button><button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={() => { window.localStorage.setItem("stpauls-form-preview", JSON.stringify({ id: "preview", name: meta.name || "Form preview", definition })); window.open("/admin/forms/preview", "_blank", "noopener,noreferrer"); }}>Preview</button><button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={onCancel}>Cancel</button><button type="button" className="focus-ring rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white" onClick={onSave}>Save form</button></div></header>
    <nav className="flex flex-wrap gap-2 border-b border-ink/10 bg-white px-5 py-3" aria-label="Form builder sections"><button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${activePanel === "editor" ? "bg-coral text-white" : "border border-ink/15 text-ink/60"}`} onClick={() => setActivePanel("editor")}>Editor</button><button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${activePanel === "settings" ? "bg-coral text-white" : "border border-ink/15 text-ink/60"}`} onClick={() => setActivePanel("settings")}>Settings</button><button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${activePanel === "styling" ? "bg-coral text-white" : "border border-ink/15 text-ink/60"}`} onClick={() => setActivePanel("styling")}>Styling</button></nav>
    <DndContext sensors={sensors} collisionDetection={canvasCollisionDetection} onDragStart={(event) => { const id = String(event.active.id); setActiveCanvasId(id.startsWith("canvas:") ? id : null); const initial = event.active.rect.current.initial; setDragPreview(id.startsWith("canvas:") && initial ? { left: initial.left, top: initial.top } : null); }} onDragMove={(event: DragMoveEvent) => { const initial = event.active.rect.current.initial; if (initial && activeCanvasId) setDragPreview({ left: initial.left + event.delta.x, top: initial.top + event.delta.y }); }} onDragCancel={() => { setActiveCanvasId(null); setDragPreview(null); }} onDragEnd={(event) => { handleDndEnd(event); setActiveCanvasId(null); setDragPreview(null); }}>
    <div className={activePanel === "editor" ? "grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,3fr)_640px]" : "hidden"}>
      <aside className="border-b border-ink/10 bg-white p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Field palette"><h3 className="text-xs font-semibold uppercase tracking-wider text-ink/55">Fields</h3><div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">{palette.map((type) => <PaletteDragItem key={type} id={`palette:${type}`} onClick={() => addField(type)}><PalettePreview type={type} /></PaletteDragItem>)}</div><h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink/55">Field groups</h3>      <div className="mt-3 grid gap-2">{formFieldGroups.map((group) => <PaletteDragItem key={group.id} id={`palette-group:${group.id}`} onClick={() => addGroup(group.id)}><span className="block text-sm font-semibold">{group.label}</span><span className="mt-1 block text-xs text-ink/55">{group.description}</span></PaletteDragItem>)}</div><h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink/55">Container</h3><div className="mt-3 grid grid-cols-3 gap-2">{[1, 2, 3, 4, 5, 6].map((columns) =>             <PaletteDragItem key={columns} id={`palette-container:columns:${columns}`} onClick={() => addContainer(columns)}><span className="mb-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{Array.from({ length: columns }, (_, index) => <i key={index} className="h-5 rounded-sm bg-coral/20" />)}      </span>{columns} column{columns === 1 ? "" : "s"}</PaletteDragItem>)}</div><div className="mt-2 grid grid-cols-2 gap-2">            <PaletteDragItem id="palette-container:accordion" onClick={() => addLayout("accordion")}>▸ Accordion</PaletteDragItem><PaletteDragItem id="palette-container:tabs" onClick={() => addLayout("tabs")}>Tabs</PaletteDragItem></div><button type="button" className="focus-ring mt-4 w-full rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={addStep}>Add step</button></aside>
      <section className="min-h-0 overflow-y-auto p-4 sm:p-6" aria-label="Form canvas"><div className="max-w-none space-y-5">{definition.steps.map((step, stepIndex) => <DroppableStep key={step.id} id={`step:${stepIndex}`}><section className="rounded-xl border border-ink/15 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><input aria-label={`Step ${stepIndex + 1} title`} className="focus-ring min-w-0 flex-1 border-b border-transparent px-1 py-1 font-semibold hover:border-ink/20" value={step.title} onChange={(event) => updateSteps(definition.steps.map((item, index) => index === stepIndex ? { ...item, title: event.target.value } : item))} /><span className="text-xs text-ink/45">{step.fields.length} fields</span></div><SortableContext items={step.fields.map((item) => `canvas:${item.id}`)} strategy={verticalListSortingStrategy}><div className="mt-3 grid grid-cols-12 gap-3">{step.fields.map((item, fieldIndex) =>       <SortableCanvasField key={item.id} id={`canvas:${item.id}`} columnSpan={Number(item.settings?.columnSpan) || 12} disabled={["name", "address"].includes(item.type) && selected?.step === stepIndex && selected.field === fieldIndex} selected={selected?.step === stepIndex && selected.field === fieldIndex && selected.column === undefined && selected.layoutItem === undefined} onClick={() => setSelected({ step: stepIndex, field: fieldIndex })} onContextMenu={(event) => openFieldContextMenu(event, { step: stepIndex, field: fieldIndex })}><div className="mb-2 flex items-center justify-between gap-3"><span className="font-semibold">{item.label}</span><span className="text-xs text-ink/50">{formFieldTypeLabel(item.type)}{item.required ? " · required" : ""}</span></div>{item.type === "section-break" && item.settings?.layout === "columns" ? <ColumnEditor field={item} onSelectField={(columnIndex, nestedField) => setSelected({ step: stepIndex, field: fieldIndex, column: columnIndex, nestedField })} onContextMenu={(event, columnIndex, nestedField) => openFieldContextMenu(event, { step: stepIndex, field: fieldIndex, column: columnIndex, nestedField })} />       : ["accordion", "tabs"].includes(String(item.settings?.layout)) ? <LayoutEditor field={item} onSelectField={(itemIndex, nestedField) => setSelected({ step: stepIndex, field: fieldIndex, layoutItem: itemIndex, nestedField })} onContextMenu={(event, itemIndex, nestedField) => openFieldContextMenu(event, { step: stepIndex, field: fieldIndex, layoutItem: itemIndex, nestedField })} /> : <FieldPreview field={item} />}<FieldDropTarget id={`field:${item.id}`} /></SortableCanvasField>)}</div></SortableContext>{step.fields.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-ink/20 p-4 text-center text-sm text-ink/50">Drag a field here or choose one from the palette.</p>}</section></DroppableStep>)}</div></section>
      <aside className="min-h-0 overflow-y-auto border-t border-ink/10 bg-white p-4 lg:border-l lg:border-t-0"             aria-label="Field settings"> {field ? <ConfiguredFieldSettings field={field} allFields={collectFormFields(definition.steps.flatMap((step) => step.fields))} update={updateField} remove={removeField} /> : <p className="text-sm text-ink/55">Select a field to edit its label, name, options, and validation.</p>}{message && <p role="alert" className="text-sm text-coral">{message}</p>}<p className="text-xs leading-5 text-ink/50">CSV export is available from the forms list. Individual submissions can be downloaded as PDF.</p></aside>
    </div>
    {activeCanvasField && dragPreview && <div className="pointer-events-none fixed z-[120] w-[min(560px,calc(100vw-2rem))] rounded-lg border border-coral bg-white p-3 text-left shadow-2xl ring-2 ring-coral/20" style={{ left: dragPreview.left, top: dragPreview.top }}><div className="mb-2 flex items-center justify-between gap-3"><span className="font-semibold">{activeCanvasField.label}</span><span className="text-xs text-ink/50">{formFieldTypeLabel(activeCanvasField.type)}{activeCanvasField.required ? " · required" : ""}</span></div><FieldPreview field={activeCanvasField} /></div>}
    </DndContext>
    {contextMenu && <div role="menu" aria-label="Field context menu" className="fixed z-[140] min-w-36 rounded-lg border border-ink/15 bg-white p-1.5 shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><button type="button" role="menuitem" className="focus-ring w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-coral hover:bg-coral/10" onClick={() => { setSelected(contextMenu.selection); removeField(); setContextMenu(null); }}>Remove</button></div>}
    <section className={activePanel === "settings" ? "min-h-0 flex-1 overflow-y-auto p-6 sm:p-10" : "hidden"} aria-label="Global form settings"><div className="grid w-full gap-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">Configuration</p><h3 className="mt-2 font-serif text-3xl">Global form settings</h3><p className="mt-2 text-sm text-ink/60">Manage the form identity, publishing state, confirmation, delivery, and export settings.</p></div><div className="grid gap-5 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Name<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={meta.name} onChange={(event) => setMeta({ ...meta, name: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Slug<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={meta.slug} onChange={(event) => setMeta({ ...meta, slug: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Status<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={meta.status} onChange={(event) => setMeta({ ...meta, status: event.target.value })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label><label className="flex items-center gap-3 self-end text-sm font-semibold">Enabled<input type="checkbox" checked={meta.enabled} onChange={(event) => setMeta({ ...meta, enabled: event.target.checked })} /></label>        <label className="grid gap-1 text-sm font-semibold">Submit button label<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={definition.submitLabel} onChange={(event) => setDefinition({ ...definition, submitLabel: event.target.value })} /></label><fieldset className="grid gap-2 sm:col-span-2"><legend className="text-sm font-semibold">After successful submission</legend><div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-normal"><input type="radio" name="confirmation-mode" checked={definition.confirmationMode === "inline"} onChange={() => setDefinition({ ...definition, confirmationMode: "inline" })} />Show inline confirmation</label><label className="flex items-center gap-2 text-sm font-normal"><input type="radio" name="confirmation-mode" checked={definition.confirmationMode === "redirect"} onChange={() => setDefinition({ ...definition, confirmationMode: "redirect" })} />Redirect to URL</label></div></fieldset>{definition.confirmationMode === "redirect" && <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Confirmation redirect URL<input type="url" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="https://example.com/thanks" value={definition.confirmationRedirectUrl} onChange={(event) => setDefinition({ ...definition, confirmationRedirectUrl: event.target.value })} /></label>}<label className="grid gap-1 text-sm font-semibold">Confirmation title<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={definition.confirmationTitle} onChange={(event) => setDefinition({ ...definition, confirmationTitle: event.target.value })} /></label>    <label className="grid gap-1 text-sm font-semibold">Confirmation message<textarea rows={3} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={definition.confirmationMessage} onChange={(event) => setDefinition({ ...definition, confirmationMessage: event.target.value })} /></label><BooleanSetting id="form-reset-on-submit" label="Reset form after submission" value={definition.resetOnSubmit} onChange={(value) => setDefinition({ ...definition, resetOnSubmit: value })} /><label className="grid gap-1 text-sm font-semibold sm:col-span-2">Failure message<textarea rows={3} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={definition.failureMessage} onChange={(event) => setDefinition({ ...definition, failureMessage: event.target.value })} /></label></div><div className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div><h4 className="font-semibold">Submission and export settings</h4><p className="mt-1 text-sm text-ink/60">Control which fields and metadata appear in the submissions table, CSV export, and submission PDFs.</p></div><BooleanSetting id="export-metadata" label="Include submission date and metadata" value={exportSettings.includeMetadata} onChange={(value) => setExportSettings({ ...exportSettings, includeMetadata: value })} /><BooleanSetting id="export-hidden-fields" label="Include hidden or conditional fields" value={exportSettings.includeHiddenFields} onChange={(value) => setExportSettings({ ...exportSettings, includeHiddenFields: value })} /><label className="grid gap-1 text-sm font-semibold">CSV date format<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={exportSettings.csvDateFormat} onChange={(event) => setExportSettings({ ...exportSettings, csvDateFormat: event.target.value as FormExportSettings["csvDateFormat"] })}><option value="iso">ISO (2026-09-08T20:33:16.000Z)</option><option value="local">Local date and time</option></select></label><label className="grid gap-1 text-sm font-semibold">PDF title<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder={meta.name || "Form submission"} value={exportSettings.pdfTitle} onChange={(event) => setExportSettings({ ...exportSettings, pdfTitle: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">PDF accent color<input type="color" className="h-11 w-full rounded-lg border border-ink/15 bg-white p-1" value={exportSettings.pdfAccentColor} onChange={(event) => setExportSettings({ ...exportSettings, pdfAccentColor: event.target.value })} /></label><fieldset className="grid gap-2 sm:col-span-2"><legend className="text-sm font-semibold">Exported field order</legend><p className="text-xs leading-5 text-ink/55">Leave unchanged to use the form editor order. Enter field names separated by commas to choose a custom order.</p><input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={exportSettings.fieldOrder.join(", ")} onChange={(event) => setExportSettings({ ...exportSettings, fieldOrder: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></fieldset></div><NotificationSettings notifications={notifications} setNotifications={setNotifications} fields={collectFormFields(definition.steps.flatMap((step) => step.fields))} /></div></section>
    <div className={activePanel === "styling" ? "flex min-h-0 flex-1" : "hidden"}><FormStylingPanel definition={definition} setDefinition={setDefinition} /></div>
  </div>;
}

function LegacyFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const options = field.options ?? [];
  const span = Number(field.settings?.columnSpan) || 12;
  const isContainer = field.type === "section-break" && field.settings?.layout === "columns";
  const isNestedLayout = field.type === "section-break" && (field.settings?.layout === "accordion" || field.settings?.layout === "tabs");
  const nestedItems = isNestedLayout ? layoutItems(field) : [];
  const widths = containerWidths(field);
  const setContainerWidth = (index: number, value: number) => {
    const next = [...widths];
    next[index] = value;
    update({ settings: { ...field.settings, columnWidths: next } });
  };
  const updateNestedItems = (items: LayoutItem[]) => update({ settings: { ...field.settings, items } });
  const addNestedItem = () => updateNestedItems([...nestedItems, { id: makeFormId("item"), title: `${field.settings?.layout === "tabs" ? "Tab" : "Panel"} ${nestedItems.length + 1}`, fields: [] }]);
  const removeNestedItem = (index: number) => { if (nestedItems.length <= 1) return; updateNestedItems(nestedItems.filter((_, itemIndex) => itemIndex !== index)); };
  return <div className="mt-3 grid gap-3 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">{isContainer ? "Selected container" : isNestedLayout ? "Selected " + String(field.settings?.layout) : "Selected field"}</h4>{isContainer && <div className="grid gap-2 rounded-lg border border-coral/20 bg-coral/5 p-3"><p className="text-xs leading-5 text-ink/60">Adjust each column relative to the others. The preview updates as you change a value.</p>{widths.map((width, index) => <label key={index} className="grid gap-1 text-sm">Column {index + 1}<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2" value={width} onChange={(event) => setContainerWidth(index, Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 8, 9, 12].map((value) => <option key={value} value={value}>{value} / 12 units</option>)}</select></label>)}</div>}{isNestedLayout && <div className="grid gap-2 rounded-lg border border-coral/20 bg-coral/5 p-3"><p className="text-xs leading-5 text-ink/60">Add and rename sections, then drag fields into each one on the canvas.</p>{nestedItems.map((item, index) => <div key={item.id} className="flex items-center gap-2"><input className="focus-ring min-w-0 flex-1 rounded border border-ink/15 bg-white px-2 py-1.5 text-sm" value={item.title} onChange={(event) => updateNestedItems(nestedItems.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} /><button type="button" className="focus-ring rounded px-2 py-1 text-xs text-coral disabled:opacity-40" disabled={nestedItems.length <= 1} onClick={() => removeNestedItem(index)} aria-label={`Remove ${item.title}`}>Remove</button></div>)}<button type="button" className="focus-ring rounded border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={addNestedItem}>Add {field.settings?.layout === "tabs" ? "tab" : "panel"}</button></div>}<label className="grid gap-1 text-sm">Label<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={field.label} onChange={(event) => update({ label: event.target.value })} /></label><label className="grid gap-1 text-sm">Field name<input pattern="[A-Za-z][A-Za-z0-9_-]*" className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={field.name} onChange={(event) => update({ name: event.target.value })} /></label><label className="grid gap-1 text-sm">Placeholder<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={field.placeholder ?? ""} onChange={(event) => update({ placeholder: event.target.value })} /></label><label className="grid gap-1 text-sm">Description<textarea rows={2} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={field.description ?? ""} onChange={(event) => update({ description: event.target.value })} /></label>{!isContainer && <label className="grid gap-1 text-sm">Width<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={span} onChange={(event) => update({ settings: { ...field.settings, columnSpan: Number(event.target.value) } })}>{[12, 9, 8, 6, 4, 3].map((value) => <option key={value} value={value}>{value === 12 ? "Full width" : `${Math.round(value / 12 * 100)}%`}</option>)}</select></label>  }{field.type !== "section-break" && field.type !== "custom-html" && field.type !== "button" && <BooleanSetting id={`${field.id}-required`} label="Required" value={field.required === true} onChange={(value) => update({ required: value })} />}{field.type === "custom-html" && <label className="grid gap-1 text-sm">HTML (sanitized on public render)<textarea rows={5} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-mono text-xs" value={String(field.settings?.html ?? "")} onChange={(event) => update({ settings: { ...field.settings, html: event.target.value } })} /></label>}{["select", "radio", "ranking", "chained-select"].includes(field.type) && <label className="grid gap-1 text-sm">Options (one label per line)<textarea rows={5} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={options.map((option) => option.label).join("\n")} onChange={(event) => { const next = event.target.value.split(/\r?\n/).filter(Boolean).map((label, index) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `option-${index + 1}` })); update({ options: next }); }} /></label>}{field.type === "chained-select" && <label className="grid gap-1 text-sm">Parent field name<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2" value={String(field.settings?.parentField ?? "")} onChange={(event) => update({ settings: { ...field.settings, parentField: event.target.value } })} /></label>}<button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button></div>;
}

function SelectFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState(0);
  const groups = Array.isArray(settings.optionGroups) ? settings.optionGroups as { label: string; options: FormOption[] }[] : [];
  const grouped = settings.optionGrouping === true;
  const options = grouped && groups.length ? groups[activeGroup]?.options ?? [] : field.options ?? [{ value: "option-1", label: "Option 1" }, { value: "option-2", label: "Option 2" }];
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const setOptions = (next: FormOption[]) => update({ options: next, settings: grouped ? { ...settings, optionGroups: groups.length ? groups.map((group, index) => index === activeGroup ? { ...group, options: next } : group) : [{ label: "Options", options: next }] } : settings });
  const updateOption = (index: number, label: string) => setOptions(options.map((option, itemIndex) => itemIndex === index ? { ...option, label, value: settings.allowCustomValues === true ? option.value : label } : option));
  const updateOptionValue = (index: number, value: string) => setOptions(options.map((option, itemIndex) => itemIndex === index ? { ...option, value } : option));
  const addOption = () => setOptions([...options, { label: `Option ${options.length + 1}`, value: `option-${options.length + 1}` }]);
  const removeOption = (index: number) => setOptions(options.length > 1 ? options.filter((_, itemIndex) => itemIndex !== index) : options);
  const moveOption = (from: number, to: number) => { if (to < 0 || to >= options.length) return; const next = [...options]; const [item] = next.splice(from, 1); next.splice(to, 0, item); setOptions(next); };
  const chooseDataset = (name: string) => { const next = (predefinedSelectSets[name] ?? []).map((option) => ({ ...option })); update({ options: next, settings: { ...settings, optionGroups: [], optionGrouping: false, defaultValue: "" } }); setDatasetOpen(false); };
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3">
    <h4 className="text-sm font-semibold">Selected select field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <label className="grid gap-1 text-sm">Placeholder<input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => update({ placeholder: event.target.value })} /></label>
      <BooleanSetting id={`${field.id}-option-grouping`} label="Enable option grouping" value={grouped} onChange={(value) => setSetting("optionGrouping", value)} />
      {grouped ? <div className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><p className="text-xs text-ink/55">Create groups, then select a group to edit its options below.</p>{(groups.length ? groups : [{ label: "Options", options }]).map((group, index) => <div key={index} className={`flex items-center gap-2 rounded px-2 py-1 ${activeGroup === index ? "bg-coral/10" : ""}`}><button type="button" className="focus-ring min-w-0 flex-1 text-left text-sm font-semibold" onClick={() => setActiveGroup(index)}>{group.label}</button><input className={`${inputClass} min-w-0 flex-1`} value={group.label} onChange={(event) => setSetting("optionGroups", (groups.length ? groups : [{ label: "Options", options }]).map((current, groupIndex) => groupIndex === index ? { ...current, label: event.target.value } : current))} /><button type="button" className="focus-ring text-sm text-coral" disabled={(groups.length || 1) <= 1} onClick={() => { setActiveGroup(Math.max(0, index - 1)); setSetting("optionGroups", groups.filter((_, groupIndex) => groupIndex !== index)); }}>Remove</button></div>)}<button type="button" className="focus-ring justify-self-start text-xs font-semibold text-coral" onClick={() => { setActiveGroup(groups.length || 1); setSetting("optionGroups", [...(groups.length ? groups : [{ label: "Options", options }]), { label: `Group ${(groups.length || 1) + 1}`, options: [] }]); }}>+ Add group</button></div> : null}
      <fieldset className="grid gap-2"><legend className="text-sm">Allow custom values</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-custom-values`} checked={settings.allowCustomValues === true} onChange={() => setSetting("allowCustomValues", true)} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-custom-values`} checked={settings.allowCustomValues !== true} onChange={() => setSetting("allowCustomValues", false)} />No</label></div></fieldset>
      <div className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Options</span><button type="button" className="focus-ring rounded border border-coral px-2 py-1 text-xs font-semibold text-coral" onClick={addOption}>+ Add option</button></div><SortableOptionList count={options.length} onMove={moveOption}>{options.map((option, index) => <SortableOptionRow key={`${option.value}-${index}`} id={`option:${index}`}><input type="radio" name={`${field.id}-default`} checked={settings.defaultValue === option.value} onChange={() => setSetting("defaultValue", option.value)} aria-label={`Make ${option.label} default`} /><input className={`${inputClass} min-w-0 flex-1`} value={option.label} onChange={(event) => updateOption(index, event.target.value)} />{settings.allowCustomValues === true && <input className={`${inputClass} min-w-0 flex-1`} placeholder="Value" aria-label={`Value for ${option.label}`} value={option.value} onChange={(event) => updateOptionValue(index, event.target.value)} />}<button type="button" className="focus-ring text-lg text-coral" onClick={() => addOption()} aria-label="Add option">+</button><button type="button" className="focus-ring text-lg text-ink/55 disabled:opacity-30" disabled={options.length <= 1} onClick={() => removeOption(index)} aria-label="Remove option">−</button></SortableOptionRow>)}</SortableOptionList><button type="button" className="focus-ring justify-self-start text-xs text-ink/60 underline" onClick={() => setSetting("defaultValue", "")}>Clear selection</button></div>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold" onClick={() => setDatasetOpen(true)}>Predefined Data Sets</button>
      <BooleanSetting id={`${field.id}-shuffle`} label="Shuffle options" value={settings.shuffled === true} onChange={(value) => setSetting("shuffled", value)} />
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Dynamic default value<input className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /></label><label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label><label className="grid gap-1 text-sm">Name attribute<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>            <ConditionalFieldControl />
    </div></details>
    {datasetOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Predefined data sets"><div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><h3 className="font-serif text-2xl">Predefined Data Sets</h3><button type="button" className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-sm" onClick={() => setDatasetOpen(false)}>Close</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.keys(predefinedSelectSets).map((name) => <button key={name} type="button" className="focus-ring rounded-lg border border-ink/15 p-3 text-left text-sm font-semibold hover:border-coral hover:bg-coral/5" onClick={() => chooseDataset(name)}>{name}<span className="mt-1 block text-xs font-normal text-ink/50">{predefinedSelectSets[name].length} options</span></button>)}</div></div></div>}
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function ChoiceFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const options = field.options ?? [{ value: "option-1", label: "Option 1" }, { value: "option-2", label: "Option 2" }];
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const setOptions = (next: FormOption[]) => update({ options: next });
  const updateOption = (index: number, label: string) => setOptions(options.map((option, itemIndex) => itemIndex === index ? { ...option, label, value: settings.allowCustomValues === true ? option.value : label } : option));
  const updateOptionValue = (index: number, value: string) => setOptions(options.map((option, itemIndex) => itemIndex === index ? { ...option, value } : option));
  const addOption = () => setOptions([...options, { label: `Option ${options.length + 1}`, value: `option-${options.length + 1}` }]);
  const removeOption = (index: number) => setOptions(options.length > 1 ? options.filter((_, itemIndex) => itemIndex !== index) : options);
  const moveOption = (from: number, to: number) => { if (to < 0 || to >= options.length) return; const next = [...options]; const [item] = next.splice(from, 1); next.splice(to, 0, item); setOptions(next); };
  const chooseDataset = (name: string) => { update({ options: (predefinedSelectSets[name] ?? []).map((option) => ({ ...option })), settings: { ...settings, defaultValue: field.type === "checkbox" ? [] : "" } }); setDatasetOpen(false); };
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3">
    <h4 className="text-sm font-semibold">Selected {field.type} field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <div className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Options</span><button type="button" className="focus-ring rounded border border-coral px-2 py-1 text-xs font-semibold text-coral" onClick={addOption}>+ Add option</button></div><SortableOptionList count={options.length} onMove={moveOption}>{options.map((option, index) => <SortableOptionRow key={`${option.value}-${index}`} id={`option:${index}`}><input className={`${inputClass} min-w-0 flex-1`} value={option.label} onChange={(event) => updateOption(index, event.target.value)} />{settings.allowCustomValues === true && <input className={`${inputClass} min-w-0 flex-1`} placeholder="Value" aria-label={`Value for ${option.label}`} value={option.value} onChange={(event) => updateOptionValue(index, event.target.value)} />}<button type="button" className="focus-ring text-lg text-coral" onClick={addOption} aria-label="Add option">+</button><button type="button" className="focus-ring text-lg text-ink/55 disabled:opacity-30" disabled={options.length <= 1} onClick={() => removeOption(index)} aria-label="Remove option">−</button></SortableOptionRow>)}</SortableOptionList></div>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold" onClick={() => setDatasetOpen(true)}>Predefined Data Sets</button>
      <BooleanSetting id={`${field.id}-shuffle`} label="Shuffle options" value={settings.shuffled === true} onChange={(value) => setSetting("shuffled", value)} />
      <BooleanSetting id={`${field.id}-other`} label="Allow other" value={settings.allowOther === true} onChange={(value) => setSetting("allowOther", value)} />
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm">Allow custom values</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-custom-values`} checked={settings.allowCustomValues === true} onChange={() => setSetting("allowCustomValues", true)} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-custom-values`} checked={settings.allowCustomValues !== true} onChange={() => setSetting("allowCustomValues", false)} />No</label></div></fieldset>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Dynamic default value<input className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /></label><label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label><label className="grid gap-1 text-sm">Name attribute<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>    <ConditionalFieldControl /></div></details>
    {datasetOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Predefined data sets"><div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><h3 className="font-serif text-2xl">Predefined Data Sets</h3><button type="button" className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-sm" onClick={() => setDatasetOpen(false)}>Close</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.keys(predefinedSelectSets).map((name) => <button key={name} type="button" className="focus-ring rounded-lg border border-ink/15 p-3 text-left text-sm font-semibold hover:border-coral hover:bg-coral/5" onClick={() => chooseDataset(name)}>{name}<span className="mt-1 block text-xs font-normal text-ink/50">{predefinedSelectSets[name].length} options</span></button>)}</div></div></div>}
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function DateFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3">
    <h4 className="text-sm font-semibold">Selected Date / Time field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Label placement<select className={inputClass} value={String(settings.labelPlacement ?? "top")} onChange={(event) => setSetting("labelPlacement", event.target.value)}>{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Placeholder<input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => update({ placeholder: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Date format<select className={inputClass} value={String(settings.dateFormat ?? "m/d/Y")} onChange={(event) => setSetting("dateFormat", event.target.value)}>{dateFormats.map(([format, example]) => <option key={format} value={format}>{format} — {example}</option>)}</select></label>
      <BooleanSetting id={`${field.id}-required`} label="Required" value={field.required === true} onChange={(value) => update({ required: value })} />
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Default value<input className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>
      <ConditionalFieldControl />
    </div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function ConfiguredFieldSettings({ field, allFields, update, remove }: { field: FormField; allFields: FormField[]; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const wrap = (content: ReactNode) => <ConditionalContext.Provider value={{ field, allFields, update }}>{content}</ConditionalContext.Provider>;
  if (field.type === "select") return wrap(<SelectFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "radio" || field.type === "checkbox") return wrap(<ChoiceFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "date") return wrap(<DateFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "file") return wrap(<FileFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "password") return wrap(<PasswordFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "masked") return wrap(<MaskedInputSettings field={field} update={update} remove={remove} />);
  if (field.type === "color") return wrap(<ColorFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "chained-select") return wrap(<ChainedSelectSettings field={field} update={update} remove={remove} />);
  if (field.type === "ranking") return wrap(<RankingFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "custom-html") return wrap(<CustomHtmlSettings field={field} allFields={allFields} update={update} remove={remove} />);
  if (field.type === "terms") return wrap(<TermsFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "button") return wrap(<ButtonFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "name" || field.type === "address") return wrap(<GroupFieldSettings field={field} update={update} remove={remove} />);
  if (field.type === "section-break" && field.settings?.layout === "columns") return wrap(<ContainerSettings field={field} update={update} remove={remove} />);
  if (field.type === "section-break") return wrap(<SectionBreakSettings field={field} allFields={allFields} update={update} remove={remove} />);
  if (!["text", "email", "phone", "textarea"].includes(field.type)) return wrap(<LegacyFieldSettings field={field} update={update} remove={remove} />);
  const settings = field.settings ?? {};
  const isPhone = field.type === "phone";
  const isLongText = field.type === "textarea";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const labelPlacement = typeof settings.labelPlacement === "string" ? settings.labelPlacement : "top";
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  return wrap(<div className="mt-3 grid gap-4 border-t border-ink/10 pt-3">
    <h4 className="text-sm font-semibold">Selected {field.type} field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3">
      <summary className="cursor-pointer font-semibold">Standard options</summary>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm">{isLongText ? "Element label" : "Field label"}<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
        <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={labelPlacement === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
        <label className="grid gap-1 text-sm">Placeholder<input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => update({ placeholder: event.target.value })} /></label>
        {isLongText && <><label className="grid gap-1 text-sm">Rows<input type="number" min={1} className={inputClass} value={String(settings.rows ?? 4)} onChange={(event) => setSetting("rows", Number(event.target.value) || 1)} /></label><label className="grid gap-1 text-sm">Columns<input type="number" min={1} className={inputClass} value={String(settings.columns ?? 40)} onChange={(event) => setSetting("columns", Number(event.target.value) || 1)} /></label></>}
        <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
        {field.type === "email" && <>        <BooleanSetting id={`${field.id}-validate-email`} label="Validate email" value={settings.validateEmail !== false} onChange={(value) => setSetting("validateEmail", value)} /><label className="grid gap-1 text-sm">Error message<input className={inputClass} value={String(settings.errorMessage ?? "Enter a valid email address.")} onChange={(event) => setSetting("errorMessage", event.target.value)} /></label></>}
        {isPhone && <><BooleanSetting id={`${field.id}-validate-phone`} label="Validate phone number" value={settings.validatePhone !== false} onChange={(value) => setSetting("validatePhone", value)} /><label className="grid gap-1 text-sm">Error message<input className={inputClass} value={String(settings.errorMessage ?? "Enter a valid USA phone number.")} onChange={(event) => setSetting("errorMessage", event.target.value)} /></label><label className="grid gap-1 text-sm">Default country<select className={inputClass} value={String(settings.defaultCountry ?? "USA")} onChange={(event) => setSetting("defaultCountry", event.target.value)}><option value="USA">USA (+1)</option></select></label></>}
      </div>
    </details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3">
      <summary className="cursor-pointer font-semibold">Advanced options</summary>
      <div className="mt-3 grid gap-3">
        {!isPhone && <label className="grid gap-1 text-sm">{isLongText ? "Default value" : "Default value"}{isLongText ? <textarea rows={4} className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /> : <input className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} />}</label>}
        <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label>
        <label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label>
        <label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label>
        {!isPhone && <><label className="grid gap-1 text-sm">Prefix label<input className={inputClass} value={String(settings.prefixLabel ?? "")} onChange={(event) => setSetting("prefixLabel", event.target.value)} /></label><label className="grid gap-1 text-sm">Suffix label<input className={inputClass} value={String(settings.suffixLabel ?? "")} onChange={(event) => setSetting("suffixLabel", event.target.value)} /></label></>}
        <label className="grid gap-1 text-sm">Name attribute<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>
        {!isPhone && <label className="grid gap-1 text-sm">Max length<input type="number" min={0} className={inputClass} value={String(settings.maxLength ?? "")} onChange={(event) => setSetting("maxLength", event.target.value ? Number(event.target.value) : undefined)} /></label>}
        <fieldset className="grid gap-2"><legend className="text-sm">Is unique</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-unique`} checked={settings.isUnique === true} onChange={() => setSetting("isUnique", true)} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-unique`} checked={settings.isUnique !== true} onChange={() => setSetting("isUnique", false)} />No</label></div></fieldset>
        <ConditionalFieldControl />
      </div>
    </details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>);
}

function SortableGroupRow({ id, name, config, fieldId, inputClass, radioClass, updateChild }: { id: string; name: string; config: Record<string, unknown>; fieldId: string; inputClass: string; radioClass: string; updateChild: (name: string, changes: Record<string, unknown>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { kind: "group-field", name } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className={`rounded-lg border bg-white p-3 transition-shadow ${isDragging ? "scale-[1.02] rotate-1 border-coral shadow-2xl ring-2 ring-coral/20" : "border-ink/10"}`}><div className="flex items-center gap-2"><button type="button" {...attributes} {...listeners} className="touch-none select-none cursor-grab text-ink/40 active:cursor-grabbing" aria-label={`Drag ${String(config.label ?? name)}`}>☰</button><label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={config.enabled !== false} onChange={(event) => updateChild(name, { enabled: event.target.checked })} />{String(config.label ?? name)}</label><span className="text-xs text-ink/40">Drag handle</span></div><details className="mt-2 border-t border-ink/10 pt-2"><summary className="cursor-pointer text-xs font-semibold text-ink/65">Configure {String(config.label ?? name)}</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Label name<input className={inputClass} value={String(config.label ?? "")} onChange={(event) => updateChild(name, { label: event.target.value })} /></label><fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${fieldId}-${name}-placement`} checked={String(config.labelPlacement ?? "top") === value} onChange={() => updateChild(name, { labelPlacement: value })} />{label}</label>)}</div></fieldset><label className="grid gap-1 text-sm">Default value<input className={inputClass} value={String(config.defaultValue ?? "")} onChange={(event) => updateChild(name, { defaultValue: event.target.value })} /></label><label className="grid gap-1 text-sm">Placeholder<input className={inputClass} value={String(config.placeholder ?? "")} onChange={(event) => updateChild(name, { placeholder: event.target.value })} /></label><label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(config.helpMessage ?? "")} onChange={(event) => updateChild(name, { helpMessage: event.target.value })} /></label>  <BooleanSetting id={`${fieldId}-${name}-required`} label="Required" value={config.required === true} onChange={(value) => updateChild(name, { required: value })} /></div></details></div>;
}

function GroupFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const type = field.type === "address" ? "address" : "name";
  const defaults = defaultGroupSettings(type);
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const configuredFields = settings.fields && typeof settings.fields === "object" && !Array.isArray(settings.fields) ? settings.fields as Record<string, Record<string, unknown>> : {};
  const order = Array.isArray(settings.order) ? settings.order.filter((item): item is string => typeof item === "string") : Object.keys(defaults.fields);
  const fields = order.length ? order : Object.keys(defaults.fields);
  const configFor = (name: string) => ({ ...(defaults.fields as Record<string, Record<string, unknown>>)[name], ...(configuredFields[name] ?? {}) });
  const updateSettings = (next: Record<string, unknown>) => update({ settings: { ...settings, ...next } });
  const updateChild = (name: string, changes: Record<string, unknown>) => updateSettings({ fields: { ...configuredFields, [name]: { ...configFor(name), ...changes } } });
  const moveField = (from: number, to: number) => { if (to < 0 || to >= fields.length) return; const next = [...fields]; const [item] = next.splice(from, 1); next.splice(to, 0, item); updateSettings({ order: next }); };
  const groupSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleGroupDragEnd = (event: DragEndEvent) => {
    const from = fields.indexOf(String(event.active.data.current?.name ?? ""));
    const to = fields.indexOf(String(event.over?.data.current?.name ?? ""));
    if (from >= 0 && to >= 0 && from !== to) moveField(from, to);
  };
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected {type} field group</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Group label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}><SortableContext items={fields.map((name) => `group:${field.id}:${name}`)} strategy={verticalListSortingStrategy}><div data-group-sort-zone className="grid gap-2"><span className="text-sm font-semibold">Fields</span><p className="text-xs leading-5 text-ink/55">Enable fields and drag them into the order visitors should complete them.</p>{fields.map((name) => <SortableGroupRow key={name} id={`group:${field.id}:${name}`} name={name} config={configFor(name)} fieldId={field.id} inputClass={inputClass} radioClass={radioClass} updateChild={updateChild} />)}</div></SortableContext></DndContext>
      {type === "address" && <label className="grid gap-1 text-sm">Autocomplete provider<select className={inputClass} value={String(settings.autocompleteProvider ?? "none")} onChange={(event) => updateSettings({ autocompleteProvider: event.target.value })}><option value="none">None</option><option value="google">Google Maps</option><option value="openstreetmap">OpenStreetMap</option></select></label>}
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      {type === "name" && <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => updateSettings({ containerClass: event.target.value })} /></label>}
      {type === "address" && <label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => updateSettings({ elementClass: event.target.value })} /></label>}
      <label className="grid gap-1 text-sm">Name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => updateSettings({ nameAttribute: event.target.value })} /></label>
      <ConditionalFieldControl />
    </div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field group</button>
  </div>;
}

function CustomHtmlSettings({ field, allFields, update, remove }: { field: FormField; allFields: FormField[]; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const html = typeof settings.html === "string" ? settings.html : "<p>Add your content here.</p>";
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected Custom HTML field</h4>
    <RichTextField value={html} onChange={(value) => setSetting("html", value)} toolbarExtras={(insertHtml) => <><MediaPicker label="Add media" onSelect={(asset) => insertHtml(`<img src="${asset.url}" alt="${asset.altText ?? asset.title ?? asset.originalName}" />`)} /><select aria-label="Insert smart code" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onChange={(event) => { const value = event.target.value; if (value) insertHtml(`{${value}}`); event.currentTarget.value = ""; }}><option value="">Smart code</option>{allFields.filter((item) => item.id !== field.id && !["section-break", "custom-html", "button"].includes(item.type)).map((item) => <option key={item.id} value={item.name}>{item.label}</option>)}</select></>} />
    <div className="rounded-lg border border-ink/10 bg-mist/20 p-3"><p className="text-xs leading-5 text-ink/55">Smart codes such as <code>{"{first_name}"}</code> are replaced with the submitted value when the form is displayed or processed. Use the Smart code toolbar control to insert one at the cursor.</p></div>
    <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label>    <ConditionalFieldControl /><button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function ButtonFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const buttonType = String(settings.buttonType ?? "submit");
  const action = String(settings.action ?? "url");
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected button field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <fieldset className="grid gap-2"><legend className="text-sm">Button type</legend><div className="flex flex-wrap gap-3">{[["submit", "Submit"], ["cancel", "Cancel"], ["next", "Next"], ["previous", "Previous"], ["other", "Other"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-button-type`} checked={buttonType === value} onChange={() => setSetting("buttonType", value)} />{label}</label>)}</div></fieldset>
      <label className="grid gap-1 text-sm">Button text<input className={inputClass} value={String(settings.buttonText ?? field.label)} onChange={(event) => { setSetting("buttonText", event.target.value); update({ label: event.target.value || "Button" }); }} /></label>
      <label className="grid gap-1 text-sm">Button style<select className={inputClass} value={String(settings.buttonStyle ?? "coral")} onChange={(event) => setSetting("buttonStyle", event.target.value)}><option value="coral">Coral</option><option value="ink">Ink</option><option value="outline">Outline</option><option value="success">Success</option><option value="muted">Muted</option></select></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Button size</legend><div className="flex flex-wrap gap-3">{[["small", "Small"], ["medium", "Medium"], ["large", "Large"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-button-size`} checked={String(settings.buttonSize ?? "medium") === value} onChange={() => setSetting("buttonSize", value)} />{label}</label>)}</div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm">Button alignment</legend><div className="flex flex-wrap gap-3">{[["left", "Left"], ["center", "Center"], ["right", "Right"], ["full", "Full width"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-button-alignment`} checked={String(settings.buttonAlignment ?? "left") === value} onChange={() => setSetting("buttonAlignment", value)} />{label}</label>)}</div></fieldset>
      <BooleanSetting id={`${field.id}-logged-in-only`} label="Show only for logged-in users" value={settings.loggedInOnly === true} onChange={(value) => setSetting("loggedInOnly", value)} />
      {buttonType === "other" && <div className="grid gap-3 rounded-lg border border-ink/10 bg-white p-3"><label className="grid gap-1 text-sm">Action<select className={inputClass} value={action} onChange={(event) => setSetting("action", event.target.value)}><option value="url">Open URL</option><option value="email">Send email</option><option value="download">Download media</option></select></label>
        {action === "url" && <><label className="grid gap-1 text-sm">URL<input type="url" className={inputClass} placeholder="https://example.com" value={String(settings.url ?? "")} onChange={(event) => setSetting("url", event.target.value)} /></label><label className="grid gap-1 text-sm">Target<select className={inputClass} value={String(settings.target ?? "_self")} onChange={(event) => setSetting("target", event.target.value)}><option value="_self">Same tab</option><option value="_blank">New tab</option></select></label></>}
        {action === "email" && <label className="grid gap-1 text-sm">Email address<input type="email" className={inputClass} placeholder="hello@example.com" value={String(settings.email ?? "")} onChange={(event) => setSetting("email", event.target.value)} /></label>}
        {action === "download" && <div className="grid gap-2"><span className="text-sm font-semibold">Media library file</span><MediaPicker label="Choose download file" mediaType="all" value={typeof settings.downloadUrl === "string" ? settings.downloadUrl : undefined} onSelect={(asset) => setSetting("downloadUrl", asset.url)} /><p className="text-xs leading-5 text-ink/55">Choose a file from the media library. Visitors will download the selected asset.</p></div>}
      </div>}
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>
      <ConditionalFieldControl />
    </div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function TermsFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const termsHtml = typeof settings.termsHtml === "string" ? settings.termsHtml : "<h2>Terms and Conditions</h2><p>Add your terms and conditions here.</p>";
  const privacyHtml = typeof settings.privacyHtml === "string" ? settings.privacyHtml : "<h2>Privacy Policy</h2><p>Add your privacy policy here.</p>";
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected terms agreement field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-4">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <BooleanSetting id={`${field.id}-show-checkbox`} label="Show checkbox" value={settings.showCheckbox !== false} onChange={(value) => setSetting("showCheckbox", value)} />
      <BooleanSetting id={`${field.id}-include-terms`} label="Include Terms and Conditions" value={settings.includeTerms !== false} onChange={(value) => setSetting("includeTerms", value)} />
      {settings.includeTerms !== false && <div className="grid gap-2"><span className="text-sm font-semibold">Terms and Conditions text</span><RichTextField value={termsHtml} onChange={(value) => setSetting("termsHtml", value)} /></div>}
      <BooleanSetting id={`${field.id}-include-privacy`} label="Include Privacy Policy" value={settings.includePrivacy !== false} onChange={(value) => setSetting("includePrivacy", value)} />
      {settings.includePrivacy !== false && <div className="grid gap-2"><span className="text-sm font-semibold">Privacy Policy text</span><RichTextField value={privacyHtml} onChange={(value) => setSetting("privacyHtml", value)} /></div>}
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>
      <ConditionalFieldControl />
    </div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function ContainerSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const widths = containerWidths(field);
  const containerWidth = Number(settings.columnSpan) || 12;
  const setWidth = (index: number, value: number) => {
    const next = [...widths];
    next[index] = value;
    update({ settings: { ...settings, columnWidths: next } });
  };
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected container</h4><p className="text-xs leading-5 text-ink/55">Adjust the container width and the relative width of each column.</p><label className="grid gap-1 text-sm">Container width<select className={inputClass} value={containerWidth} onChange={(event) => update({ settings: { ...settings, columnSpan: Number(event.target.value) } })}>{[12, 9, 8, 6, 4, 3].map((value) => <option key={value} value={value}>{value === 12 ? "Full width" : `${Math.round(value / 12 * 100)}%`}</option>)}</select></label><div className="grid gap-2">{widths.map((width, index) => <label key={index} className="grid gap-1 text-sm">Column {index + 1} width<select className={inputClass} value={width} onChange={(event) => setWidth(index, Number(event.target.value))}>{[1, 2, 3, 4, 6, 8, 9, 12].map((value) => <option key={value} value={value}>{value} / 12 units</option>)}</select></label>)}</div><button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove container</button></div>;
}

function SectionBreakSettings({ field, allFields, update, remove }: { field: FormField; allFields: FormField[]; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const html = typeof settings.html === "string" ? settings.html : "<p>Add section content here.</p>";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const nested = ["accordion", "tabs"].includes(String(settings.layout));
  const items = layoutItems(field);
  const widths = containerWidths(field);
  const updateItems = (next: LayoutItem[]) => update({ settings: { ...settings, items: next } });
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected section break</h4>
    {settings.layout === "columns" && <div className="grid gap-2 rounded-lg border border-coral/20 bg-coral/5 p-3"><p className="text-xs leading-5 text-ink/60">Adjust each column relative to the others.</p>{widths.map((width, index) => <label key={index} className="grid gap-1 text-sm">Column {index + 1}<select className={inputClass} value={width} onChange={(event) => { const next = [...widths]; next[index] = Number(event.target.value); update({ settings: { ...settings, columnWidths: next } }); }}>{[1, 2, 3, 4, 6, 8, 9, 12].map((value) => <option key={value} value={value}>{value} / 12 units</option>)}</select></label>)}</div>}
    {nested && <div className="grid gap-2 rounded-lg border border-coral/20 bg-coral/5 p-3"><p className="text-xs leading-5 text-ink/60">Manage the sections used by this {String(settings.layout)} layout.</p>{items.map((item, index) => <div key={item.id} className="flex items-center gap-2"><input className={`${inputClass} min-w-0 flex-1`} value={item.title} onChange={(event) => updateItems(items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} /><button type="button" className="focus-ring rounded px-2 py-1 text-xs text-coral disabled:opacity-40" disabled={items.length <= 1} onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<button type="button" className="focus-ring rounded border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={() => updateItems([...items, { id: makeFormId("item"), title: `${settings.layout === "tabs" ? "Tab" : "Panel"} ${items.length + 1}`, fields: [] }])}>Add {settings.layout === "tabs" ? "tab" : "panel"}</button></div>}
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <div className="grid gap-2"><span className="text-sm font-semibold">Section content</span><RichTextField value={html} onChange={(value) => setSetting("html", value)} toolbarExtras={(insertHtml) => <select aria-label="Insert smart code" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onChange={(event) => { const value = event.target.value; if (value) insertHtml(`{${value}}`); event.currentTarget.value = ""; }}><option value="">Smart code</option>{allFields.filter((item) => item.id !== field.id && !["section-break", "custom-html", "button"].includes(item.type)).map((item) => <option key={item.id} value={item.name}>{item.label}</option>)}</select>} /></div>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label>        <ConditionalFieldControl /></div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function SharedFieldSettings({ field, update, remove, title, children }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void; title: string; children?: ReactNode }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">{title}</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <label className="grid gap-1 text-sm">Placeholder<input className={inputClass} value={field.placeholder ?? ""} onChange={(event) => update({ placeholder: event.target.value })} /></label>{children}
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Default value<input className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /></label><label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label><label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>            <ConditionalFieldControl />
    </div></details><button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button></div>;
}

function PasswordFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  return <SharedFieldSettings field={field} update={update} remove={remove} title="Selected password field" />;
}

function ColorFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  return <SharedFieldSettings field={field} update={update} remove={remove} title="Selected color picker field" />;
}

function ChainedSelectSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const rows = Array.isArray(settings.chainRows) ? settings.chainRows.filter((row): row is { parent: string; child?: string; grandchild?: string } => Boolean(row && typeof row === "object" && typeof (row as { parent?: unknown }).parent === "string")).map((row) => ({ parent: row.parent, child: row.child ?? "", grandchild: row.grandchild ?? "" })) : [];
  const levels = Array.isArray(settings.levels) && settings.levels.length === 3 ? settings.levels.map(String) : ["Parent", "Child", "Grandchild"];
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const parseCsv = (text: string) => {
    const parsed = text.trim().split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))).filter((cells) => cells.some(Boolean));
    const header = parsed[0] ?? [];
    const data = parsed.slice(1).filter((cells) => cells.length >= 2).map((cells) => ({ parent: cells[0] ?? "", child: cells[1] ?? "", grandchild: cells[2] ?? "" })).filter((row) => row.parent && row.child);
    setSetting("levels", [header[0] || "Parent", header[1] || "Child", header[2] || "Grandchild"]);
    setSetting("chainRows", data);
  };
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected chained select field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Default value<input className={inputClass} placeholder="Parent / Child / Grandchild" value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm">Data source</legend><div className="flex flex-wrap gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-source`} checked={settings.sourceMode !== "remote"} onChange={() => setSetting("sourceMode", "csv")} />CSV upload</label><label className={radioClass}><input type="radio" name={`${field.id}-source`} checked={settings.sourceMode === "remote"} onChange={() => setSetting("sourceMode", "remote")} />Remote URL</label></div></fieldset>
      {settings.sourceMode === "remote" ? <label className="grid gap-1 text-sm">Remote URL<input type="url" className={inputClass} placeholder="https://example.com/data.csv" value={String(settings.remoteUrl ?? "")} onChange={(event) => setSetting("remoteUrl", event.target.value)} /></label> : <><label className="grid gap-1 text-sm">CSV data source<input type="file" accept=".csv,text/csv" className={inputClass} onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(parseCsv); }} /></label><a className="text-sm font-semibold text-coral underline" download="chained-select-sample.csv" href="data:text/csv;charset=utf-8,Parent%2CChild%2CGrandchild%0A2015%2CAcura%2CILX%0A2015%2CAcura%2CMDX">Download sample CSV</a><p className="text-xs leading-5 text-ink/55">Use a header row followed by one row per relationship: Parent, Child, Grandchild. The third column may be blank for two-level data.</p></>}
      <div className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><p className="text-sm font-semibold">Level names</p>{levels.map((level, index) => <label key={index} className="grid gap-1 text-sm">{["Parent", "Child", "Grandchild"][index]}<input className={inputClass} value={level} onChange={(event) => setSetting("levels", levels.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} /></label>)}</div>
      {rows.length > 0 && <p className="text-xs text-ink/55">{rows.length} relationship rows loaded from the data source.</p>}
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label><label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>        <ConditionalFieldControl /></div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function RankingFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const options = field.options ?? [{ label: "Option 1", value: "option-1" }, { label: "Option 2", value: "option-2" }, { label: "Option 3", value: "option-3" }];
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const setOptions = (next: FormOption[]) => update({ options: next });
  const updateOption = (index: number, changes: Partial<FormOption>) => setOptions(options.map((option, itemIndex) => itemIndex === index ? { ...option, ...changes } : option));
  const addOption = () => setOptions([...options, { label: `Option ${options.length + 1}`, value: `option-${options.length + 1}` }]);
  const removeOption = (index: number) => setOptions(options.length > 1 ? options.filter((_, itemIndex) => itemIndex !== index) : options);
  const moveOption = (from: number, to: number) => { if (to < 0 || to >= options.length) return; const next = [...options]; const [item] = next.splice(from, 1); next.splice(to, 0, item); setOptions(next); };
  const chooseDataset = (name: string) => setOptions((predefinedSelectSets[name] ?? []).map((option) => ({ ...option })));
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3"><h4 className="text-sm font-semibold">Selected ranking field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm">Options</legend><div className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3"><SortableOptionList count={options.length} onMove={moveOption}>{options.map((option, index) => <SortableOptionRow key={`${option.value}-${index}`} id={`option:${index}`}><input className={`${inputClass} min-w-0 flex-1`} value={option.label} onChange={(event) => updateOption(index, { label: event.target.value, value: event.target.value })} /><span className="text-xs text-ink/45">{option.value}</span>{settings.photos === true && <label className="cursor-pointer text-xs font-semibold text-coral">Photo<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.arrayBuffer().then((buffer) => updateOption(index, { photo: `data:${file.type};base64,${btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))))}` })); }} /></label>}<button type="button" className="focus-ring text-lg text-coral" onClick={addOption} aria-label="Add option">+</button><button type="button" className="focus-ring text-lg text-ink/55 disabled:opacity-30" disabled={options.length <= 1} onClick={() => removeOption(index)} aria-label="Remove option">−</button></SortableOptionRow>)}</SortableOptionList></div></fieldset>
      <label className="grid gap-1 text-sm">Predefined data set<select className={inputClass} defaultValue="" onChange={(event) => { if (event.target.value) chooseDataset(event.target.value); }}><option value="">Choose a data set…</option>{Object.keys(predefinedSelectSets).map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <BooleanSetting id={`${field.id}-show-values`} label="Show values" value={settings.showValues === true} onChange={(value) => setSetting("showValues", value)} /><BooleanSetting id={`${field.id}-photos`} label="Photo" value={settings.photos === true} onChange={(value) => setSetting("photos", value)} /><BooleanSetting id={`${field.id}-shuffle`} label="Shuffle options" value={settings.shuffled === true} onChange={(value) => setSetting("shuffled", value)} /><BooleanSetting id={`${field.id}-show-position`} label="Show position number" value={settings.showPosition !== false} onChange={(value) => setSetting("showPosition", value)} /><BooleanSetting id={`${field.id}-show-reset`} label="Show reset icon" value={settings.showReset !== false} onChange={(value) => setSetting("showReset", value)} />
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Default value<input className={inputClass} value={String(settings.defaultValue ?? "")} onChange={(event) => setSetting("defaultValue", event.target.value)} /></label><label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label><label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label><label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>        <ConditionalFieldControl /></div></details><button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function MaskedInputSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const [helpOpen, setHelpOpen] = useState(false);
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  return <SharedFieldSettings field={field} update={update} remove={remove} title="Selected masked input field">
    <label className="grid gap-1 text-sm">Mask format<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2" value={String(settings.maskType ?? "phone")} onChange={(event) => setSetting("maskType", event.target.value)}><option value="phone">Phone — (555) 123-4567</option><option value="date">Date — 01/31/2026</option><option value="time">Time — 09:30</option><option value="datetime">Date and time — 01/31/2026 09:30</option><option value="ssn">Social security — 123-45-6789</option><option value="custom">Custom</option></select></label>
    {settings.maskType === "custom" && <><label className="grid gap-1 text-sm">Custom mask<input className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2" placeholder="(000) 000-0000" value={String(settings.customMask ?? "")} onChange={(event) => setSetting("customMask", event.target.value)} /></label><button type="button" className="focus-ring justify-self-start text-sm font-semibold text-coral underline" onClick={() => setHelpOpen(true)}>How do custom masks work?</button></>}
    <BooleanSetting id={`${field.id}-reverse-mask`} label="Reversible mask" value={settings.reverseMask === true} onChange={(value) => setSetting("reverseMask", value)} /><BooleanSetting id={`${field.id}-clear-mismatch`} label="Clear value if it does not match the mask" value={settings.clearOnMismatch !== false} onChange={(value) => setSetting("clearOnMismatch", value)} />
    <label className="grid gap-1 text-sm">Mobile keyboard type<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2" value={String(settings.mobileKeyboardType ?? "numeric")} onChange={(event) => setSetting("mobileKeyboardType", event.target.value)}><option value="numeric">Numeric</option><option value="decimal">Decimal</option><option value="tel">Phone</option></select></label>
    {helpOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Custom mask instructions"><div className="max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h3 className="font-serif text-2xl">Custom mask instructions</h3><p className="mt-3 text-sm leading-6 text-ink/70">Use <strong>0</strong> for a required digit, <strong>A</strong> for a letter, and <strong>*</strong> for a letter or digit. Any other character is shown as fixed formatting. For example, <code>000-00-0000</code> creates a Social Security number pattern.</p><button type="button" className="focus-ring mt-4 rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold" onClick={() => setHelpOpen(false)}>Close</button></div></div>}
  </SharedFieldSettings>;
}

function FileFieldSettings({ field, update, remove }: { field: FormField; update: (changes: Partial<FormField>) => void; remove: () => void }) {
  const settings = field.settings ?? {};
  const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
  const radioClass = "flex items-center gap-2 text-sm font-normal";
  const setSetting = (key: string, value: unknown) => update({ settings: { ...settings, [key]: value } });
  const allowed = Array.isArray(settings.allowedFiles) ? settings.allowedFiles.filter((item): item is string => typeof item === "string") : [];
  const types = [["images", "Images", "jpg, jpeg, png, gif, webp, svg"], ["audio", "Audio", "mp3, wav, ogg, m4a"], ["video", "Video", "mp4, mov, avi, webm"], ["pdf", "PDF", "pdf"], ["docs", "Docs", "doc, docx, txt, rtf"], ["zip", "Zip Archives", "zip, rar, 7z, gz"], ["executable", "Executable Files", "exe, msi, app, bin"], ["csv", "CSV", "csv"]] as const;
  return <div className="mt-3 grid gap-4 border-t border-ink/10 pt-3">
    <h4 className="text-sm font-semibold">Selected File upload field</h4>
    <details open className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Standard options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Element label<input className={inputClass} value={field.label} onChange={(event) => update({ label: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Button text<input className={inputClass} value={String(settings.buttonText ?? "Choose file")} onChange={(event) => setSetting("buttonText", event.target.value)} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Upload interface</legend><div className="flex flex-wrap gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-interface`} checked={settings.uploadInterface !== "dropzone"} onChange={() => setSetting("uploadInterface", "button")} />Button</label><label className={radioClass}><input type="radio" name={`${field.id}-interface`} checked={settings.uploadInterface === "dropzone"} onChange={() => setSetting("uploadInterface", "dropzone")} />Dropzone</label></div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm">Label placement</legend><div className="flex flex-wrap gap-3">{[["default", "Default"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["hide", "Hide"]].map(([value, label]) => <label key={value} className={radioClass}><input type="radio" name={`${field.id}-label-placement`} checked={(settings.labelPlacement ?? "top") === value} onChange={() => setSetting("labelPlacement", value)} />{label}</label>)}</div></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm">Required</legend><div className="flex gap-4"><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required === true} onChange={() => update({ required: true })} />Yes</label><label className={radioClass}><input type="radio" name={`${field.id}-required`} checked={field.required !== true} onChange={() => update({ required: false })} />No</label></div></fieldset>
      <label className="grid gap-1 text-sm">Max file size <span className="flex items-center"><input type="number" min={1} step="0.1" className={`${inputClass} min-w-0 flex-1 rounded-r-none`} value={String(settings.maxFileSize ?? 20)} onChange={(event) => setSetting("maxFileSize", Number(event.target.value) || 1)} /><span className="rounded-r-lg border border-l-0 border-ink/15 bg-mist/50 px-3 py-2 text-sm text-ink/60">MB</span></span></label>
      <label className="grid gap-1 text-sm">Error message for oversized files<input className={inputClass} value={String(settings.errorMessage ?? "This file exceeds the maximum size.")} onChange={(event) => setSetting("errorMessage", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Max files count<input type="number" min={1} className={inputClass} value={String(settings.maxFiles ?? 1)} onChange={(event) => setSetting("maxFiles", Number(event.target.value) || 1)} /></label>
      <label className="grid gap-1 text-sm">Error message for too many files<input className={inputClass} value={String(settings.maxFilesErrorMessage ?? "Too many files selected.")} onChange={(event) => setSetting("maxFilesErrorMessage", event.target.value)} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm">Allowed files</legend><div className="grid gap-2 sm:grid-cols-2">{types.map(([value, label, extensions]) => <label key={value} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={allowed.includes(value)} onChange={(event) => setSetting("allowedFiles", event.target.checked ? [...allowed, value] : allowed.filter((item) => item !== value))} /><span>{label} <span className="text-ink/50">({extensions})</span></span></label>)}</div></fieldset>
      <label className="grid gap-1 text-sm">Error message for unauthorized files<input className={inputClass} value={String(settings.unauthorizedErrorMessage ?? "This file type is not allowed.")} onChange={(event) => setSetting("unauthorizedErrorMessage", event.target.value)} /></label>
    </div></details>
    <details className="rounded-xl border border-ink/10 bg-mist/20 p-3"><summary className="cursor-pointer font-semibold">Advanced options</summary><div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Container class<input className={inputClass} value={String(settings.containerClass ?? "")} onChange={(event) => setSetting("containerClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Element class<input className={inputClass} value={String(settings.elementClass ?? "")} onChange={(event) => setSetting("elementClass", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Help message<textarea rows={2} className={inputClass} value={String(settings.helpMessage ?? "")} onChange={(event) => setSetting("helpMessage", event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Field name<input className={inputClass} value={String(settings.nameAttribute ?? "")} onChange={(event) => setSetting("nameAttribute", event.target.value)} /></label>
      <ConditionalFieldControl />
    </div></details>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral" onClick={remove}>Remove field</button>
  </div>;
}

function PalettePreview({ type }: { type: FormFieldType }) {
  return <><span className="block text-xs font-semibold">{formFieldTypeLabel(type)}</span><FieldPreview field={{ id: "palette", type, name: "preview", label: "Example", options: [{ value: "one", label: "Option one" }, { value: "two", label: "Option two" }] }} /></>;
}

function FieldPreview({ field }: { field: FormField }) {
  const settings = field.settings ?? {};
  const [showHelp, setShowHelp] = useState(false);
  const helpMessage = typeof settings.helpMessage === "string" ? settings.helpMessage : "";
  const fieldName = typeof settings.nameAttribute === "string" && settings.nameAttribute ? settings.nameAttribute : field.name;
  const help = helpMessage ? <span className="relative inline-flex align-middle"><span role="button" tabIndex={0} aria-label={`Show help for ${fieldName}`} onClick={(event) => { event.stopPropagation(); setShowHelp((visible) => !visible); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setShowHelp((visible) => !visible); } }} className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-coral text-[10px] font-bold text-coral">?</span>{showHelp && <span role="status" className="absolute left-5 top-5 z-20 w-48 rounded-lg border border-ink/10 bg-white p-2 text-[11px] font-normal leading-4 text-ink shadow-xl">{helpMessage}</span>}</span> : null;
  const label = <div className="mb-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-ink/70"><span>{field.label || fieldName}</span>{help}<span className="font-mono text-[10px] font-normal text-ink/35">({fieldName})</span></div>;
  let content: ReactNode;
  if (field.type === "section-break" && settings.layout === "columns") {
    const columns = Number(settings.columns) || 1;
    const widths = containerWidths(field);
    content = <div className="grid gap-1" style={{ gridTemplateColumns: widths.map((width) => `${width}fr`).join(" ") }}>{Array.from({ length: columns }, (_, index) => <span key={index} className="h-6 rounded border border-dashed border-coral/50 bg-coral/10" />)}</div>;
  } else if (field.type === "section-break" && settings.layout === "accordion") content = <div className="rounded border border-ink/15 bg-white px-2 py-1 text-xs">▸ Accordion panel</div>;
  else if (field.type === "section-break" && settings.layout === "tabs") content = <div className="flex gap-1 text-xs"><span className="rounded-t border border-b-0 border-ink/15 px-2 py-1">Tab 1</span><span className="rounded-t border border-b-0 border-ink/15 px-2 py-1 text-ink/45">Tab 2</span></div>;
  else if (field.type === "ranking") content = <div className="space-y-1">{(field.options ?? []).slice(0, 3).map((option, index) => <div key={option.value} className="flex items-center gap-2 rounded border border-ink/10 bg-white px-2 py-1 text-xs"><span className="text-ink/45">{index + 1}</span>{option.label}<span className="ml-auto text-ink/35">↕</span></div>)}</div>;
  else if (field.type === "radio" || field.type === "checkbox") content = <div className="space-y-1 text-xs">{(field.options ?? []).slice(0, 2).map((option) => <div key={option.value}><span className="mr-1 inline-block h-3 w-3 rounded-full border border-ink/30 align-[-2px]" />{option.label}</div>)}</div>;
  else if (field.type === "chained-select") content = <div className="grid grid-cols-2 gap-1"><span className="rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink/45">Country</span><span className="rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink/45">State</span></div>;
  else if (field.type === "section-break") content = <div className="border-t border-coral pt-2 text-xs text-ink/45">{String(settings.html ?? "Section heading and divider")}</div>;
  else if (field.type === "custom-html") content = <div className="rounded border border-dashed border-ink/20 bg-white p-2 text-xs text-ink/65" dangerouslySetInnerHTML={{ __html: String(settings.html ?? "Rich text content") }} />;
  else if (field.type === "name" || field.type === "address") {
    const defaults = defaultGroupSettings(field.type);
    const configured = settings.fields && typeof settings.fields === "object" && !Array.isArray(settings.fields) ? settings.fields as Record<string, Record<string, unknown>> : {};
    const order = Array.isArray(settings.order) ? settings.order.filter((name): name is string => typeof name === "string") : Object.keys(defaults.fields);
    const visible = order.filter((name) => (configured[name]?.enabled ?? (defaults.fields as Record<string, Record<string, unknown>>)[name]?.enabled) !== false);
    content = <div className="grid gap-1">{visible.map((name) => { const child = { ...(defaults.fields as Record<string, Record<string, unknown>>)[name], ...(configured[name] ?? {}) }; return <span key={name} className="rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink/60">{String(child.label ?? name)}{child.defaultValue ? <span className="ml-1 text-ink/40">· {String(child.defaultValue)}</span> : child.placeholder ? <span className="ml-1 text-ink/35">· {String(child.placeholder)}</span> : null}</span>; })}</div>;
  } else if (field.type === "textarea") content = <div className="min-h-10 rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink/35">{String(settings.defaultValue ?? field.placeholder ?? "")}</div>;
  else if (field.type === "button") {
    const buttonSize = String(settings.buttonSize ?? "medium");
    const buttonStyle = String(settings.buttonStyle ?? "coral");
    const buttonAlignment = String(settings.buttonAlignment ?? "left");
    const sizeClass = buttonSize === "small" ? "px-3 py-2 text-xs" : buttonSize === "large" ? "px-6 py-3.5 text-sm" : "px-5 py-2.5 text-xs";
    const styleClass = buttonStyle === "outline" ? "border border-[rgb(var(--color-coral))] text-[rgb(var(--color-coral))]" : buttonStyle === "ink" ? "bg-[rgb(var(--color-ink))] text-white" : buttonStyle === "success" ? "bg-green-700 text-white" : buttonStyle === "muted" ? "bg-mist text-ink" : "bg-coral text-white";
    const alignmentClass = buttonAlignment === "center" ? "justify-center" : buttonAlignment === "right" ? "justify-end" : "justify-start";
    content = <div className={`flex ${alignmentClass}`}><span className={`inline-flex items-center rounded-full font-semibold ${buttonAlignment === "full" ? "w-full justify-center" : ""} ${sizeClass} ${styleClass}`}>{String(settings.buttonText ?? field.label)}</span></div>;
  }
  else if (field.type === "color") content = <div className="h-7 w-12 rounded border border-ink/15 bg-coral" />;
  else content = <div className="min-h-7 rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink/45">{String(settings.defaultValue ?? field.placeholder ?? (field.type === "select" ? "Choose…" : "Enter value…"))}</div>;
  const placement = typeof settings.labelPlacement === "string" ? settings.labelPlacement : "top";
  const prefix = typeof settings.prefixLabel === "string" && settings.prefixLabel ? <span className="shrink-0 rounded-l border border-r-0 border-ink/15 bg-mist/60 px-2 py-1 text-xs text-ink/55">{settings.prefixLabel}</span> : null;
  const suffix = typeof settings.suffixLabel === "string" && settings.suffixLabel ? <span className="shrink-0 rounded-r border border-l-0 border-ink/15 bg-mist/60 px-2 py-1 text-xs text-ink/55">{settings.suffixLabel}</span> : null;
  const control = prefix || suffix ? <div className="flex items-stretch">{prefix}{content}{suffix}</div> : content;
  if (["section-break", "button"].includes(field.type)) return <div className="form-builder-field-preview">{content}</div>;
  if (placement === "hide") return <div className="form-builder-field-preview">{control}</div>;
  if (placement === "right") return <div className="form-builder-field-preview flex items-center gap-3">{control}<div className="shrink-0">{label}</div></div>;
  if (placement === "bottom") return <div className="form-builder-field-preview">{control}{label}</div>;
  if (placement === "left") return <div className="form-builder-field-preview flex items-start gap-3"><div className="shrink-0">{label}</div>{control}</div>;
  return <div className="form-builder-field-preview">{label}{control}</div>;
}

function containerWidths(field: FormField) {
  const columns = Number(field.settings?.columns) || 1;
  const raw = field.settings?.columnWidths;
  if (Array.isArray(raw) && raw.length === columns && raw.every((value) => typeof value === "number" && value > 0)) return columns === 1 ? [Number(raw[0]) === 1 ? 12 : Number(raw[0])] : raw as number[];
  return Array.from({ length: columns }, () => columns === 1 ? 12 : 1);
}

function columnFields(field: FormField): FormField[][] {
  const columns = Number(field.settings?.columns) || 1;
  const raw = field.settings?.columnFields;
  if (!Array.isArray(raw)) return Array.from({ length: columns }, () => []);
  return Array.from({ length: columns }, (_, index) => Array.isArray(raw[index]) ? raw[index].filter((item): item is FormField => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof (item as FormField).id === "string")) : []);
}

type LayoutItem = { id: string; title: string; fields: FormField[] };
function layoutItems(field: FormField): LayoutItem[] {
  const raw = field.settings?.items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is LayoutItem => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof (item as LayoutItem).title === "string")).map((item) => ({ ...item, fields: Array.isArray(item.fields) ? item.fields : [] }));
}

function LayoutEditor({ field, onSelectField, onContextMenu }: { field: FormField; onSelectField: (itemIndex: number, fieldIndex: number) => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>, itemIndex: number, fieldIndex: number) => void }) {
  const items = layoutItems(field);
  return <div className="grid gap-2" onClick={(event) => event.stopPropagation()}>{items.map((item, index) => <DroppableLayoutItem key={item.id} id={`layout:${field.id}:${index}`}><div className="text-xs font-semibold">{item.title}</div>{item.fields.length ? <SortableContext items={item.fields.map((nested) => `layout-field:${field.id}:${index}:${nested.id}`)} strategy={verticalListSortingStrategy}><div className="mt-2 grid gap-1.5">{item.fields.map((nested, nestedIndex) => <SortableLayoutField key={nested.id} id={`layout-field:${field.id}:${index}:${nested.id}`} item={nested} layoutId={field.id} itemIndex={index} onSelect={() => onSelectField(index, nestedIndex)} onContextMenu={(event) => onContextMenu(event, index, nestedIndex)} />)}</div></SortableContext> : <div className="mt-2 rounded border border-dashed border-ink/20 px-2 py-2 text-center text-[11px] text-ink/45">Drop a field here</div>}</DroppableLayoutItem>)}</div>;
}

function ColumnEditor({ field, onSelectField, onContextMenu }: { field: FormField; onSelectField: (columnIndex: number, fieldIndex: number) => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>, columnIndex: number, fieldIndex: number) => void }) {
  const columns = columnFields(field);
  const widths = containerWidths(field);
  return <div className="grid min-w-0 w-full gap-2 rounded-xl border border-dashed border-coral/45 bg-coral/[0.03] p-2" style={{ gridTemplateColumns: widths.map((width) => `${width}fr`).join(" ") }} onClick={(event) => event.stopPropagation()}>{columns.map((items, index) => <DroppableColumn key={index} id={`column:${field.id}:${index}`}><div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink/45"><span>Column {index + 1}</span><span>{`${items.length} field${items.length === 1 ? "" : "s"}`}</span></div>{items.length ? <SortableContext items={items.map((item) => `column-field:${field.id}:${index}:${item.id}`)} strategy={verticalListSortingStrategy}><div className="mt-2 grid gap-1.5">{items.map((item, itemIndex) => <SortableColumnField key={item.id} id={`column-field:${field.id}:${index}:${item.id}`} item={item} containerId={field.id} columnIndex={index} onSelect={() => onSelectField(index, itemIndex)} onContextMenu={(event) => onContextMenu(event, index, itemIndex)} />)}</div></SortableContext> : <div className="mt-3 rounded-md border border-dashed border-coral/30 bg-coral/5 px-2 py-3 text-center text-[11px] text-ink/45">Drop a field here</div>}</DroppableColumn>)}</div>;
}
