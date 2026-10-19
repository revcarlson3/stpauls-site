"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";
import { couponDiscountLabel } from "@/lib/coupon-ui";

type Coupon = { id: string; code: string; name: string; discountType: string; percentageOff: number | null; amountOff: string | null; currency: string; startsAt: string; endsAt: string | null; isActive: boolean; redemptionCount: number };
type CouponForm = Record<string, string>;

const initialForm: CouponForm = { discountType: "PERCENTAGE", percentageOff: "10", currency: "USD" };

export default function Coupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CouponForm>(initialForm);
  const load = () => fetch("/api/global-admin/coupons").then(async (response) => {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error);
    setRows(value);
  }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load coupons."));
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/global-admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const value = await response.json();
    if (!response.ok) { setError(value.error); return; }
    setForm(initialForm);
    void load();
  }
  async function change(id: string, method: string) {
    const response = await fetch(`/api/global-admin/coupons/${id}`, { method, headers: { "Content-Type": "application/json" } });
    if (!response.ok) { const value = await response.json(); setError(value.error); return; }
    void load();
  }
  const fixedAmount = form.discountType === "FIXED_AMOUNT";
  const update = (name: string, value: string) => setForm((current) => ({ ...current, [name]: value }));
  return <main className="min-h-screen bg-sand py-10"><Container><div className="flex justify-end"><GlobalAdminBackLink /></div><h1 className="mt-8 font-serif text-4xl">Coupons</h1><p className="mt-3 text-sm text-ink/60">Platform-wide coupons are validated at checkout; no provider credentials are stored in coupon records.</p>{error && <Notification variant="danger" className="mt-4">{error}</Notification>}<Card className="mt-6 p-5"><form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(7rem,1fr)_minmax(9rem,1.2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(7rem,.8fr)_minmax(10rem,1.2fr)_minmax(10rem,1.2fr)_auto] xl:items-end"><label className="grid gap-1 text-sm font-semibold">Code<input required value={form.code || ""} onChange={(event) => update("code", event.target.value)} placeholder="WELCOME" className="min-w-0 rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Name<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} placeholder="Optional name" className="min-w-0 rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Discount type<select value={form.discountType} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, discountType: value, percentageOff: value === "PERCENTAGE" ? "10" : "", amountOff: value === "FIXED_AMOUNT" ? "5.00" : "" })); }} className="rounded border px-3 py-2 font-normal"><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option></select></label><label className="grid gap-1 text-sm font-semibold">{couponDiscountLabel(form.discountType, form.currency || "")}<input required min={fixedAmount ? "0.01" : "1"} max={fixedAmount ? undefined : "100"} step={fixedAmount ? "0.01" : "1"} type="number" value={fixedAmount ? form.amountOff || "" : form.percentageOff || ""} onChange={(event) => update(fixedAmount ? "amountOff" : "percentageOff", event.target.value)} placeholder={fixedAmount ? "5.00" : "10"} className="min-w-0 rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Currency<input required={fixedAmount} value={form.currency || ""} onChange={(event) => update("currency", event.target.value.toUpperCase())} placeholder="USD" className="min-w-0 rounded border px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">{fixedAmount ? "ISO 4217 code used for the amount." : "Used when the subscription is billed."}</span></label><label className="grid gap-1 text-sm font-semibold">Starts<input type="datetime-local" value={form.startsAt || ""} onChange={(event) => update("startsAt", event.target.value)} className="min-w-0 rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Ends<input type="datetime-local" value={form.endsAt || ""} onChange={(event) => update("endsAt", event.target.value)} className="min-w-0 rounded border px-3 py-2 font-normal" /></label><button className="rounded bg-ink px-4 py-2 font-semibold text-white">Create coupon</button><p className="xl:col-span-full text-xs text-ink/60">{fixedAmount ? "Fixed amount means a positive amount off the subscription price in the selected currency; do not enter a negative sign." : "Percentage means a positive percentage off the subscription price; do not enter a negative sign or currency symbol."}</p></form></Card><div className="mt-6 grid gap-3">{rows.map((row) => <Card key={row.id} className="flex items-center justify-between p-4"><div><strong>{row.code}</strong><span className="ml-3 text-sm text-ink/60">{row.discountType === "PERCENTAGE" ? `${row.percentageOff}% off` : `${row.amountOff} ${row.currency} off`} · {row.isActive ? "Active" : "Disabled"} · {row.redemptionCount} redemptions</span></div><div className="flex gap-2">{row.isActive && <button onClick={() => void change(row.id, "POST")} className="rounded border px-2 py-1 text-xs">Disable</button>}<button onClick={() => { if (window.confirm("Delete this coupon?")) void change(row.id, "DELETE"); }} className="rounded border px-2 py-1 text-xs">Delete</button></div></Card>)}</div></Container></main>;
}
