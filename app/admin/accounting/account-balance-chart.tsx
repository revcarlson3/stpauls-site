"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type AccountBalance = { id: string; name: string; type: string; balance: number };

const colors = ["#2f7f7b", "#d86f52", "#1f2933", "#d39b36", "#4a83b5"];
const typeLabels: Record<string, string> = { CHECKING: "Checking", SAVINGS: "Savings", PETTY_CASH: "Petty cash", CASH: "Cash on hand", GIFT_CARD: "Gift cards" };
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function AccountBalanceCharts({ accounts, compact = false }: { accounts: AccountBalance[]; compact?: boolean }) {
  const sortedAccounts = [...accounts].sort((a, b) => b.balance - a.balance);
  const total = sortedAccounts.reduce((sum, account) => sum + account.balance, 0);
  const positiveAccounts = sortedAccounts.filter((account) => account.balance > 0);

  if (!accounts.length) {
    return <div className="mt-6 rounded-xl border border-dashed border-ink/15 px-5 py-8 text-center"><p className="font-semibold">No account balances yet</p><p className="mt-1 text-sm text-ink/60">Add a bank or cash account to populate the dashboard charts.</p></div>;
  }

  return <div className={compact ? "mt-7" : "mt-6"}><div className={compact ? "grid gap-7" : "grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.75fr)]"}><div role="img" aria-label={`Bar chart showing balances for ${accounts.length} accounts`}><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Balance by account</p><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={sortedAccounts} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }} barCategoryGap="24%"><CartesianGrid horizontal={false} stroke="#e6e1d8" strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => currency.format(value)} tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={compact ? 100 : 120} tick={{ fill: "#1f2933", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => currency.format(Number(value))} labelFormatter={(label) => String(label)} contentStyle={{ border: "1px solid #e6e1d8", borderRadius: 12, boxShadow: "0 8px 24px rgba(31, 41, 51, 0.12)" }} /><Bar dataKey="balance" name="Balance" radius={[0, 6, 6, 0]}>{sortedAccounts.map((account, index) => <Cell key={account.id} fill={account.balance < 0 ? "#d86f52" : colors[index % colors.length]} />)}</Bar></BarChart></ResponsiveContainer></div></div>{!compact && <div className="flex flex-col items-center justify-center border-t border-ink/10 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" role="img" aria-label="Pie chart showing the positive balance mix by account"><div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={positiveAccounts} dataKey="balance" nameKey="name" cx="50%" cy="45%" innerRadius={54} outerRadius={82} paddingAngle={3}>{positiveAccounts.map((account, index) => <Cell key={account.id} fill={colors[index % colors.length]} />)}</Pie><Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} /><Tooltip formatter={(value) => currency.format(Number(value))} contentStyle={{ border: "1px solid #e6e1d8", borderRadius: 12, boxShadow: "0 8px 24px rgba(31, 41, 51, 0.12)" }} /></PieChart></ResponsiveContainer></div></div>}</div><div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-ink/10 pt-4"><p className="text-sm text-ink/60">Total recorded balance</p><p className="text-xl font-semibold">{currency.format(total)}</p></div><div className="sr-only">{sortedAccounts.map((account) => <span key={account.id}>{account.name}, {typeLabels[account.type] ?? account.type}, {currency.format(account.balance)}</span>)}</div></div>;
}
