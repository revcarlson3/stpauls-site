"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Month = { month: string; income: number; expenses: number };
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function FinancialSummaryPanels({ monthly }: { monthly: Month[] }) {
  const income = monthly.reduce((sum, month) => sum + month.income, 0);
  const expenses = monthly.reduce((sum, month) => sum + month.expenses, 0);
  return <div className="mt-8 grid gap-4 md:grid-cols-2"><SummaryPanel title="Income" total={income} dataKey="income" color="#2f7f7b" data={monthly} /><SummaryPanel title="Expenses" total={expenses} dataKey="expenses" color="#d86f52" data={monthly} /></div>;
}

function SummaryPanel({ title, total, dataKey, color, data }: { title: string; total: number; dataKey: "income" | "expenses"; color: string; data: Month[] }) {
  const hasData = total !== 0 || data.some((month) => month[dataKey] !== 0);
  return <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{title}</h2><p className="mt-1 text-sm text-ink/60">Current fiscal year</p></div><p className="text-xl font-semibold">{currency.format(total)}</p></div>{hasData ? <div className="mt-5 h-44" role="img" aria-label={`${title} by month for the current fiscal year`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e6e1d8" strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} width={38} /><Tooltip formatter={(value) => currency.format(Number(value))} contentStyle={{ border: "1px solid #e6e1d8", borderRadius: 12, boxShadow: "0 8px 24px rgba(31, 41, 51, 0.12)" }} /><Bar dataKey={dataKey} name={title} fill={color} radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="mt-5 flex h-44 items-center justify-center rounded-xl border border-dashed border-ink/15 px-5 text-center"><p className="text-sm text-ink/60">No posted {title.toLowerCase()} transactions in the current fiscal year.</p></div>}</section>;
}
