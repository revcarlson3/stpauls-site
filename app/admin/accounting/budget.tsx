"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";

type Item = { id: string; accountId: string; code: string; name: string; parentId: string | null; isEnabled: boolean; annualAmount: number; months: number[] };
type Budget = { id: string; fiscalYear: number; entryMode: "MONTHLY" | "ANNUAL"; items: Item[] };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inputClass = "focus-ring w-[4.5rem] rounded-lg border border-ink/15 bg-white px-2 py-2 text-right text-sm font-sans sm:w-20";
const groupLabels: Record<string, string> = { "4": "Unrestricted income", "5": "Restricted expenses" };

export function Budget() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [mode, setMode] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyPreviousYear, setCopyPreviousYear] = useState(true);
  const [hideDisabledItems, setHideDisabledItems] = useState(false);
  const pendingSaves = useRef(new Set<Promise<void>>());

  const load = useCallback(async (requestYear = year) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/budgets?year=${requestYear}`);
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load the budget.");
      setBudget(value.budget);
      setMode(value.budget?.entryMode ?? "MONTHLY");
    } finally {
      setLoading(false);
    }
  }, [year]);
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, [load]);

  async function addBudget() {
    if (budget) return;
    setCreating(true); setError(""); setNotice("");
    try { const response = await fetch("/api/accounting/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fiscalYear: year, copyFromPreviousYear: copyPreviousYear }) }); const value = await response.json(); if (!response.ok) throw new Error(value.error); setBudget(value.budget); setNotice(copyPreviousYear ? `Budget ready with values copied from ${year - 1}.` : "Standard budget ready."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create the budget."); }
    finally { setCreating(false); }
  }
  async function update(item: Item, changes: Partial<Item>) {
    if (!budget) return;
    const descendantIds = new Set<string>([item.accountId]);
    if (typeof changes.isEnabled === "boolean") {
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of budget.items) {
          if (candidate.parentId && descendantIds.has(candidate.parentId) && !descendantIds.has(candidate.accountId)) {
            descendantIds.add(candidate.accountId);
            changed = true;
          }
        }
      }
    }
    const next = { ...item, ...changes };
    setBudget({ ...budget, items: budget.items.map((current) => descendantIds.has(current.accountId) ? { ...current, ...(typeof changes.isEnabled === "boolean" ? { isEnabled: changes.isEnabled } : {}), ...(current.id === item.id ? next : {}) } : current) });
    const save = (async () => {
      const response = await fetch(`/api/accounting/budgets/${budget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, isEnabled: next.isEnabled, annualAmount: next.annualAmount, months: next.months }) });
      if (!response.ok) { const value = await response.json(); setError(value.error ?? "Unable to save the budget item."); await load(); }
      else setNotice("Budget saved.");
    })();
    pendingSaves.current.add(save);
    try { await save; } finally { pendingSaves.current.delete(save); }
  }
  async function changeMode(next: "MONTHLY" | "ANNUAL") {
    if (!budget) return;
    setError(""); setNotice("");
    await Promise.all(Array.from(pendingSaves.current));
    const response = await fetch(`/api/accounting/budgets/${budget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryMode: next }) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Unable to change the data-entry mode.");
    setMode(next);
    await load(year);
    setNotice("Budget saved.");
  }
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(Date.UTC(2000, index, 1)))), []);
  const children = useMemo(() => {
    const map = new Map<string, Item[]>();
    budget?.items.forEach((item) => { if (item.parentId) map.set(item.parentId, [...(map.get(item.parentId) ?? []), item]); });
    return map;
  }, [budget]);
  function total(item: Item): number {
    if (!item.isEnabled) return 0;
    const descendants = children.get(item.accountId) ?? [];
    if (item.code.slice(-2) !== "00" && !descendants.length) return mode === "ANNUAL" ? item.annualAmount : item.months.reduce((sum, value) => sum + value, 0);
    return descendants.reduce((sum, child) => sum + total(child), 0);
  }
  function monthlyTotal(item: Item, index: number): number {
    if (!item.isEnabled) return 0;
    const descendants = children.get(item.accountId) ?? [];
    if (leaf(item)) return item.months[index] ?? 0;
    return descendants.reduce((sum, child) => sum + monthlyTotal(child, index), 0);
  }
  function leaf(item: Item) { return item.code.slice(-2) !== "00" && !(children.get(item.accountId)?.length); }
  const groupedRows = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of budget?.items ?? []) {
      const key = item.code.charAt(0);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const ids = new Set(items.map((item) => item.accountId));
      const roots = items.filter((item) => !item.parentId || !ids.has(item.parentId)).sort((a, b) => a.code.localeCompare(b.code));
      const walk = (item: Item, depth: number): Array<{ item: Item; depth: number }> => [
        { item, depth },
        ...(children.get(item.accountId) ?? []).filter((child) => ids.has(child.accountId)).sort((a, b) => a.code.localeCompare(b.code)).flatMap((child) => walk(child, depth + 1))
      ];
      return { key, label: groupLabels[key] ?? `Account group ${key}`, rows: roots.flatMap((item) => walk(item, 0)) };
    });
  }, [budget, children]);
  const grandTotal = budget?.items.reduce((sum, item) => sum + (leaf(item) && item.isEnabled ? (mode === "MONTHLY" ? item.months.reduce((a, b) => a + b, 0) : item.annualAmount) : 0), 0) ?? 0;
  const currentYear = new Date().getUTCFullYear();
  const yearOptions = Array.from({ length: 15 }, (_, index) => currentYear - 7 + index);
  return <div className="mt-8 font-sans">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div><h2 className="text-2xl font-semibold tracking-tight">Standard budget</h2><p className="mt-1 max-w-xl text-sm text-ink/60">Enter amounts for detail accounts. Parent accounts calculate read-only totals from enabled children.</p></div><Button type="button" onClick={addBudget} disabled={creating || loading || Boolean(budget)}>{creating ? "Preparing…" : budget ? "Budget already exists" : "Add a budget"}</Button></div>
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-white p-4"><label className="grid gap-1 text-sm font-semibold">Fiscal year<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-sans" value={year} disabled={loading || creating} onChange={(event) => { const nextYear = Number(event.target.value); setYear(nextYear); setBudget(null); setError(""); setNotice(""); void load(nextYear).catch((reason: Error) => setError(reason.message)); }}>{yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Data entry<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-sans" value={mode} onChange={(event) => { void changeMode(event.target.value as "MONTHLY" | "ANNUAL"); }}><option value="MONTHLY">Monthly amounts</option><option value="ANNUAL">Annual amounts</option></select></label><label className="inline-flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={hideDisabledItems} onChange={(event) => setHideDisabledItems(event.target.checked)} />Hide disabled budget items</label></div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}{notice && <p role="status" className="mt-4 rounded-lg bg-teal/10 p-3 text-sm text-teal">{notice}</p>}
    {!budget ? <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-10 text-center"><p className="font-semibold">No budget loaded</p><p className="mt-1 text-sm text-ink/60">Use Add a budget to create the standard budget for this fiscal year.</p><label className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={copyPreviousYear} onChange={(event) => setCopyPreviousYear(event.target.checked)} />Copy values from {year - 1}</label></div> : <div className="mt-6 grid gap-5">{groupedRows.map(({ key, label, rows }) => { const visibleRows = rows.filter(({ item }) => !hideDisabledItems || item.isEnabled); if (!visibleRows.length) return null; return <section key={key} className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"><div className="border-b border-ink/10 bg-mist/50 px-5 py-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/70">{label}</h3><p className="mt-1 text-xs text-ink/50">Accounts are grouped and indented by hierarchy.</p></div><div className="divide-y divide-ink/10">{visibleRows.map(({ item, depth }) => { const editable = leaf(item); const itemTotal = mode === "MONTHLY" ? months.reduce((sum, _, index) => sum + monthlyTotal(item, index), 0) : total(item); return <div key={item.id} className={`${!item.isEnabled ? "opacity-45" : ""} px-4 py-3 sm:px-5`}><div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2" style={{ paddingLeft: `${depth * 1.25}rem` }}><div className="min-w-[12rem] flex-1"><p className={`font-sans text-sm ${editable ? "font-semibold" : "font-bold"}`}>{item.code} — {item.name}</p><p className="mt-0.5 text-xs text-ink/50">{editable ? "Detail account" : "Calculated rollup"}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-ink/45">Total</span><span className="min-w-[6rem] text-right text-sm font-semibold">{money.format(itemTotal)}</span><button type="button" className="text-xs font-semibold text-coral hover:underline" onClick={() => void update(item, { isEnabled: !item.isEnabled })}>{item.isEnabled ? "Disable" : "Re-enable"}</button></div></div>{mode === "MONTHLY" ? <div className="mt-3 overflow-x-auto rounded-lg border border-ink/10 bg-mist/30" style={{ marginLeft: `${depth * 1.25}rem` }}><div className="grid min-w-[50rem] grid-cols-[7rem_repeat(12,minmax(4.5rem,1fr))] items-center gap-1 px-2 py-2 text-xs"><span className="font-semibold text-ink/50">Monthly</span>{months.map((month, index) => <label key={month} className="text-center font-semibold text-ink/50">{month}{editable ? <input aria-label={`${item.code} ${month}`} className={`mt-1 ${inputClass}`} type="number" min="0" step="0.01" value={item.months[index] || ""} disabled={!item.isEnabled} onChange={(event) => { const values = [...item.months]; values[index] = Number(event.target.value) || 0; void update(item, { months: values }); }} /> : <span className="mt-1 block px-1 py-2 text-right text-xs font-semibold text-ink">{money.format(monthlyTotal(item, index))}</span>}</label>)}</div></div> : <div className="mt-3 flex items-center justify-end gap-2" style={{ marginLeft: `${depth * 1.25}rem` }}><label className="text-xs font-semibold text-ink/50">{editable ? "Annual amount" : "Annual rollup"}{editable ? <input aria-label={`${item.code} annual`} className={`ml-2 ${inputClass}`} type="number" min="0" step="0.01" value={item.annualAmount || ""} disabled={!item.isEnabled} onChange={(event) => void update(item, { annualAmount: Number(event.target.value) || 0 })} /> : <span className="ml-2 text-sm font-semibold text-ink">{money.format(itemTotal)}</span>}</label></div>}</div>; })}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/15 bg-mist/40 px-5 py-4 text-sm font-semibold"><span>Section total</span><span>{money.format(rows.reduce((sum, { item }) => sum + (leaf(item) && item.isEnabled ? (mode === "MONTHLY" ? item.months.reduce((a, b) => a + b, 0) : item.annualAmount) : 0), 0))}</span></div></section>; })}<div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-mist/50 px-5 py-4 text-sm font-semibold"><span>Budget total</span><span>{money.format(grandTotal)}</span></div></div>}
  </div>;
}
