"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";
import { defaultFooterLayout, defaultHeaderLayout, type FooterLayout, type HeaderLayout } from "@/lib/site-layout-types";

type Props = { mode: "header" | "footer" };
type Menu = { id: string; name: string };
type Widget = { id: string; name: string; type: "menu" | "text"; enabled: boolean };
const PRESET_COLORS = [["White", "#ffffff"], ["Mist", "#f3f6f8"], ["Sand", "#f4eee6"], ["Ink", "#17324d"], ["Black", "#000000"], ["Coral", "#e66f51"], ["Blue", "#2563eb"], ["Green", "#15803d"]] as const;

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<div className="flex gap-2"><select aria-label={`${label} preset`} className="focus-ring min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 font-normal" value={PRESET_COLORS.some(([, color]) => color === value) ? value : ""} onChange={(event) => { if (event.target.value) onChange(event.target.value); }}><option value="">Choose a preset</option>{PRESET_COLORS.map(([name, color]) => <option key={color} value={color}>{name}</option>)}</select><input aria-label={`${label} custom color`} type="color" className="h-11 w-12 rounded-lg border border-ink/15 bg-white p-1" value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

export function SiteLayoutEditor({ mode }: Props) {
  const [header, setHeader] = useState<HeaderLayout>(defaultHeaderLayout);
  const [footer, setFooter] = useState<FooterLayout>(defaultFooterLayout);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void Promise.all([fetch("/api/site-layout"), fetch("/api/menus"), fetch("/api/widgets")]).then(async ([layoutResponse, menusResponse, widgetsResponse]) => {
      if (!layoutResponse.ok) throw new Error("Unable to load site layout settings.");
      const layout = await layoutResponse.json();
      setHeader({ ...defaultHeaderLayout, ...layout.header });
      setFooter({ ...defaultFooterLayout, ...layout.footer, columns: Array.isArray(layout.footer?.columns) ? layout.footer.columns : defaultFooterLayout.columns });
      if (menusResponse.ok) setMenus(await menusResponse.json());
      if (widgetsResponse.ok) setWidgets((await widgetsResponse.json()).filter((widget: Widget) => widget.enabled));
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function save() {
    setMessage("");
    const response = await fetch("/api/site-layout", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ header, footer }) });
    setMessage(response.ok ? "Layout settings saved." : "Unable to save layout settings.");
  }

  function updateColumn(index: number, changes: Partial<FooterLayout["columns"][number]>) {
    setFooter((current) => ({ ...current, columns: current.columns.map((column, columnIndex) => columnIndex === index ? { ...column, ...changes } : column) }));
  }

  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Theme</p><h1 className="mt-2 font-serif text-4xl">{mode === "header" ? "Header configuration" : "Footer configuration"}</h1><p className="mt-2 max-w-2xl text-ink/60">{mode === "header" ? "Control the global header’s scale, colors, navigation, and scrolling behavior." : "Build the global footer with columns, reusable widgets, legal copy, and visual treatment."}</p><Card className="mt-8 max-w-4xl"><div className="grid gap-5">
    {mode === "header" ? <><label className="grid gap-1 text-sm font-semibold">Header height<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={header.height} onChange={(event) => setHeader({ ...header, height: event.target.value as HeaderLayout["height"] })}><option value="compact">Compact</option><option value="standard">Standard</option><option value="tall">Tall</option></select></label><div className="grid gap-4 sm:grid-cols-2"><ColorField label="Background color" value={header.background} onChange={(background) => setHeader({ ...header, background })} /><ColorField label="Text color" value={header.textColor} onChange={(textColor) => setHeader({ ...header, textColor })} /></div><label className="grid gap-1 text-sm font-semibold">Navigation menu<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={header.menuId ?? ""} onChange={(event) => setHeader({ ...header, menuId: event.target.value || null })}><option value="">Use the primary menu location</option>{menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label><label className="flex items-center justify-between gap-3 text-sm font-semibold">Sticky header<input type="checkbox" checked={header.sticky} onChange={(event) => setHeader({ ...header, sticky: event.target.checked })} /></label></> : <><div className="grid gap-4 sm:grid-cols-2"><ColorField label="Footer background" value={footer.background} onChange={(background) => setFooter({ ...footer, background })} /><ColorField label="Footer text color" value={footer.textColor} onChange={(textColor) => setFooter({ ...footer, textColor })} /></div><label className="grid gap-1 text-sm font-semibold">Footer style<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={footer.style} onChange={(event) => setFooter({ ...footer, style: event.target.value as FooterLayout["style"] })}><option value="columns">Columns</option><option value="simple">Simple</option><option value="centered">Centered</option></select></label><label className="grid gap-1 text-sm font-semibold">Copyright text<div className="flex"><button type="button" aria-label="Insert copyright symbol" title="Insert copyright symbol" className="focus-ring rounded-l-lg border border-r-0 border-ink/15 bg-mist px-3 font-serif text-lg text-ink/70 hover:bg-sand" onClick={() => setFooter((current) => ({ ...current, copyright: current.copyright.startsWith("©") ? current.copyright : `© ${current.copyright}` }))}>©</button><input className="focus-ring min-w-0 flex-1 rounded-r-lg border border-ink/15 px-3 py-2 font-normal" placeholder="2026 St. Paul's Church" value={footer.copyright} onChange={(event) => setFooter({ ...footer, copyright: event.target.value })} /></div></label><label className="grid gap-1 text-sm font-semibold">Site design credit<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="Designed with care by..." value={footer.credit} onChange={(event) => setFooter({ ...footer, credit: event.target.value })} /></label><div className="grid gap-3"><h2 className="font-serif text-2xl">Footer columns</h2><p className="text-sm text-ink/60">Assign an enabled reusable widget to each column. Text widgets are useful for contact details; menu widgets create navigation columns.</p>{footer.columns.map((column, index) => <div key={index} className="grid gap-2 rounded-lg border border-ink/10 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="grid gap-1 text-sm font-semibold">Column {index + 1} heading<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={column.heading} onChange={(event) => updateColumn(index, { heading: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Widget<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={column.widgetId ?? ""} onChange={(event) => updateColumn(index, { widgetId: event.target.value || null })}><option value="">No widget</option>{widgets.map((widget) => <option key={widget.id} value={widget.id}>{widget.name} ({widget.type})</option>)}</select></label><button type="button" className="focus-ring rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold" onClick={() => updateColumn(index, { heading: "", widgetId: null })}>Clear</button></div>)}</div></>}
    <div className="flex flex-wrap items-center gap-3"><button type="button" className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" onClick={() => void save()}>Save {mode}</button>{message && <p className="text-sm text-ink/60">{message}</p>}</div>
  </div></Card></Container></main>;
}
