"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";

type Account = { id: string; code: string; name: string; type: string; description: string | null; isActive: boolean; parentId: string | null };
const typeLabels: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Fund balances",
  UNRESTRICTED_INCOME: "Unrestricted income",
  RESTRICTED_EXPENSE: "Restricted expenses",
  RESTRICTED_INCOME: "Restricted income",
  RESTRICTED_EXPENDITURE: "Restricted expenditures",
  INCOME: "Church-defined income",
  EXPENSE: "Church-defined expenses"
};
const functions = ["Outreach", "Pastoral support", "Christian worship", "Christian witness", "Christian Stewardship", "Christian growth", "Christian youth", "Christian welfare", "Christian School", "Administration", "Church properties"];
const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const parentCode = (code: string) => {
  if (!/^\d{5}$/.test(code)) return null;
  if (code.slice(3) !== "00") return `${code.slice(0, 3)}00`;
  if (code.slice(2) !== "000") return `${code.slice(0, 2)}000`;
  if (code.slice(1) !== "0000") return `${code[0]}0000`;
  return null;
};

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ code: "", name: "", type: "EXPENSE", description: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", description: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hideDisabled, setHideDisabled] = useState(false);

  async function load() {
    const response = await fetch("/api/accounting/chart-of-accounts");
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Unable to load chart of accounts.");
    setAccounts(value.accounts ?? []);
  }
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, []);

  const visibleAccounts = useMemo(() => hideDisabled ? accounts.filter((account) => account.isActive) : accounts, [accounts, hideDisabled]);
  const grouped = useMemo(() => visibleAccounts.reduce<Record<string, Account[]>>((groups, account) => {
    const group = account.code.startsWith("4") ? "UNRESTRICTED_INCOME"
      : account.code.startsWith("5") ? "RESTRICTED_EXPENSE"
      : account.code.startsWith("6") ? "RESTRICTED_INCOME"
      : account.code.startsWith("7") ? "RESTRICTED_EXPENDITURE"
      : account.type;
    (groups[group] ??= []).push(account);
    return groups;
  }, {}), [visibleAccounts]);

  const accountTrees = useMemo(() => {
    const byCode = new Map(visibleAccounts.map((account) => [account.code, account]));
    const effectiveParent = (account: Account) => {
      if (account.parentId && visibleAccounts.some((candidate) => candidate.id === account.parentId && candidate.id !== account.id)) return account.parentId;
      const code = parentCode(account.code);
      return code && byCode.get(code)?.id !== account.id ? byCode.get(code)?.id ?? null : null;
    };
    const children = new Map<string | null, Account[]>();
    for (const account of visibleAccounts) {
      const key = effectiveParent(account);
      children.set(key, [...(children.get(key) ?? []), account]);
    }
    return (type: string) => {
      const group = grouped[type] ?? [];
      const groupIds = new Set(group.map((account) => account.id));
      const roots = group.filter((account) => {
        const parent = effectiveParent(account);
        return !parent || !groupIds.has(parent);
      }).sort((a, b) => a.code.localeCompare(b.code));
      const walk = (account: Account, depth: number): Array<{ account: Account; depth: number }> => [
        { account, depth },
        ...(children.get(account.id) ?? []).filter((child) => child.id !== account.id && groupIds.has(child.id)).sort((a, b) => a.code.localeCompare(b.code)).flatMap((child) => walk(child, depth + 1))
      ];
      return roots.flatMap((account) => walk(account, 0));
    };
  }, [visibleAccounts, grouped]);

  async function createAccount(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const response = await fetch("/api/accounting/chart-of-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to create account."); return; }
    setAccounts((current) => [...current, value.account].sort((a, b) => a.code.localeCompare(b.code)));
    setForm({ code: "", name: "", type: "EXPENSE", description: "" }); setNotice("Account added.");
  }

  function startEditing(account: Account) {
    setEditing(account.id);
    setEditForm({ code: account.code, name: account.name, description: account.description ?? "" });
    setError("");
    setNotice("");
  }

  async function updateAccount(account: Account, values: { code?: string; name?: string; description?: string; isActive?: boolean }) {
    setError(""); setNotice("");
    const response = await fetch(`/api/accounting/chart-of-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to update account."); return; }
    if (values.isActive !== undefined) await load();
    else setAccounts((current) => current.map((item) => item.id === account.id ? value.account : item).sort((a, b) => a.code.localeCompare(b.code)));
    setEditing(null);
    setNotice(values.isActive === undefined ? "Account updated." : values.isActive ? "Account enabled." : "Account disabled.");
    window.dispatchEvent(new CustomEvent("accounting:accounts-changed"));
  }

  return <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
    <section className="rounded-2xl border border-ink/10 bg-white shadow-sm">
      <div className="border-b border-ink/10 px-6 py-5"><h2 className="text-2xl font-semibold tracking-tight">Standard account list</h2><p className="mt-2 text-sm text-ink/60">Accounts are shown in code order and indented by hierarchy. The first digit identifies the class; digits 2–3 identify the function; digits 4–5 identify the detail account.</p><label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={hideDisabled} onChange={(event) => setHideDisabled(event.target.checked)} />Hide disabled accounts</label></div>
      <div className="divide-y divide-ink/10">{Object.entries(typeLabels).map(([type, label]) => { const rows = accountTrees(type); return <div key={type} className="px-6 py-5"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">{label} <span className="font-normal text-ink/45">({rows.length})</span></h3>{rows.length ? <div className="mt-3 grid gap-1">{rows.map(({ account, depth }) => <div key={account.id} style={{ marginLeft: `${depth * 1.5}rem` }} className={`rounded-lg border-l-2 px-3 py-2 ${account.isActive ? "border-teal/35 bg-mist/50" : "border-ink/15 bg-ink/5 opacity-70"}`}>{editing === account.id ? <div className="grid gap-2"><label className="grid gap-1 text-xs font-semibold">Code<input required pattern="\d{5}" maxLength={5} inputMode="numeric" value={editForm.code} onChange={(event) => setEditForm({ ...editForm, code: event.target.value })} className={inputClass} /></label><label className="grid gap-1 text-xs font-semibold">Name<input required maxLength={120} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className={inputClass} /></label><label className="grid gap-1 text-xs font-semibold">Description<textarea maxLength={500} rows={2} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} className={inputClass} /></label><div className="flex gap-2"><Button type="button" onClick={() => void updateAccount(account, editForm)}>Save</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button></div></div> : <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-mono text-sm font-semibold text-ink">{account.code}</span><span className="text-sm text-ink">{account.name}</span><span className={`text-xs font-semibold ${account.isActive ? "text-teal" : "text-ink/50"}`}>{account.isActive ? "Active" : "Inactive"}</span></div>{account.description && <p className="mt-1 text-xs text-ink/60">{account.description}</p>}</div><div className="flex shrink-0 gap-2"><Button type="button" variant="secondary" onClick={() => startEditing(account)}>Edit</Button><Button type="button" variant="secondary" onClick={() => void updateAccount(account, { isActive: !account.isActive })}>{account.isActive ? "Disable" : "Enable"}</Button></div></div>}</div>)}</div> : <p className="mt-2 text-sm text-ink/50">No accounts yet.</p>}</div>; })}</div>
    </section>
    <aside className="grid content-start gap-5">
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm"><h2 className="font-serif text-xl">Add account</h2><p className="mt-1 text-sm text-ink/60">Use five digits. Codes 8xxxx and 9xxxx are reserved for church-defined accounts.</p>{error && <p role="alert" className="mt-3 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}{notice && <p role="status" className="mt-3 rounded-lg bg-teal/10 p-3 text-sm text-teal">{notice}</p>}<form onSubmit={createAccount} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Account code<input required pattern="\d{5}" maxLength={5} inputMode="numeric" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={inputClass} placeholder="51010" /></label><label className="grid gap-1 text-sm font-semibold">Name<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Teaching materials" /></label><label className="grid gap-1 text-sm font-semibold">Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={inputClass}><option value="ASSET">Assets</option><option value="LIABILITY">Liabilities</option><option value="EQUITY">Fund balances</option><option value="INCOME">Income</option><option value="EXPENSE">Expenses</option></select></label><label className="grid gap-1 text-sm font-semibold">Description<textarea maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} rows={3} /></label><Button type="submit">Add account</Button></form></section>
      <section className="rounded-2xl border border-ink/10 bg-mist/50 p-5"><h2 className="font-serif text-xl">Function codes</h2><p className="mt-1 text-sm text-ink/60">Digits 2–3 identify the ministry function. Digits 4–5 identify the specific account.</p><ol className="mt-3 grid gap-1 text-sm text-ink/70">{functions.map((name, index) => <li key={name}><span className="mr-2 font-mono font-semibold">{String(index + 1).padStart(2, "0")}</span>{name}</li>)}</ol></section>
    </aside>
  </div>;
}
