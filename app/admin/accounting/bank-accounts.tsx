"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const types = [["CHECKING", "Checking"], ["SAVINGS", "Savings"], ["PETTY_CASH", "Petty cash"], ["CASH", "Cash on hand"], ["GIFT_CARD", "Gift cards"]] as const;

export function AccountActions() {
  const [form, setForm] = useState({ name: "", type: "CHECKING", institution: "", accountNumber: "", openingBalance: "0.00" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsModalOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isModalOpen]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/accounting/bank-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to create account.");
      return;
    }
    setForm({ name: "", type: "CHECKING", institution: "", accountNumber: "", openingBalance: "0.00" });
    setIsModalOpen(false);
    window.dispatchEvent(new Event("accounting:accounts-changed"));
  }

  return <><Button type="button" onClick={() => { setError(""); setIsModalOpen(true); }}>Add account</Button>{isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="add-account-title"><div className="flex items-start justify-between gap-4"><div><h2 id="add-account-title" className="font-serif text-2xl">Add account</h2><p className="mt-2 text-sm text-ink/60">Bank account numbers are encrypted and only the last four digits are retained for display.</p></div><button type="button" className="focus-ring rounded-lg px-2 py-1 text-2xl leading-none text-ink/55 hover:bg-ink/5 hover:text-ink" onClick={() => setIsModalOpen(false)} aria-label="Close add account dialog">×</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}<form onSubmit={add} className="mt-5 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Account name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Operating checking" /></label><label className="grid gap-1 text-sm font-semibold">Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={inputClass}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Bank or institution <span className="font-normal text-ink/50">(optional)</span><input value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} className={inputClass} /></label>{!["PETTY_CASH", "CASH", "GIFT_CARD"].includes(form.type) && <label className="grid gap-1 text-sm font-semibold">Account number<input required value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} className={inputClass} inputMode="numeric" /></label>}<label className="grid gap-1 text-sm font-semibold">Beginning balance<input required type="number" step="0.01" value={form.openingBalance} onChange={(event) => setForm({ ...form, openingBalance: event.target.value })} className={inputClass} /></label><div className="mt-3 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit">Save account</Button></div></form></div></div>}</>;
}
