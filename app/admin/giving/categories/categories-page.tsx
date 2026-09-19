"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Container } from "@/components/ui";

type Account = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  givingEnabled: boolean;
  onlineGivingEnabled: boolean;
  givingFundId: string | null;
};
type Fund = { id: string; code: string; name: string };

const parentCode = (code: string) => {
  if (!/^\d{5}$/.test(code)) return null;
  if (code.slice(3) !== "00") return `${code.slice(0, 3)}00`;
  if (code.slice(2) !== "000") return `${code.slice(0, 2)}000`;
  if (code.slice(1) !== "0000") return `${code[0]}0000`;
  return null;
};

export function CategoriesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [fundId, setFundId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/giving/categories");
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Unable to load giving categories.");
      setAccounts(value.accounts ?? []);
      setFunds(value.funds ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load giving categories.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const effectiveParent = (account: Account) => {
      if (
        account.parentId &&
        byId.has(account.parentId) &&
        account.parentId !== account.id
      )
        return account.parentId;
      const code = parentCode(account.code);
      return code && byCode.get(code)?.id !== account.id
        ? (byCode.get(code)?.id ?? null)
        : null;
    };
    const children = new Map<string | null, Account[]>();
    accounts.forEach((account) => {
      const parent = effectiveParent(account);
      children.set(parent, [...(children.get(parent) ?? []), account]);
    });
    const walk = (
      account: Account,
      depth: number,
    ): Array<{ account: Account; depth: number; hasChildren: boolean }> => [
      { account, depth, hasChildren: (children.get(account.id) ?? []).length > 0 },
      ...(children.get(account.id) ?? [])
        .sort((a, b) => a.code.localeCompare(b.code))
        .flatMap((child) => walk(child, depth + 1)),
    ];
    return accounts
      .filter(
        (account) =>
          !effectiveParent(account) ||
          !byId.has(effectiveParent(account) ?? ""),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
      .flatMap((account) => walk(account, 0));
  }, [accounts]);

  async function update(account: Account, changes: Record<string, unknown>) {
    setError("");
    setNotice("");
    const response = await fetch("/api/giving/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id, ...changes }),
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to update category.");
      return;
    }
    await load();
    setNotice(
      changes.onlineGivingEnabled !== undefined
        ? value.account.onlineGivingEnabled
          ? "Online giving enabled."
          : "Online giving disabled."
        : changes.givingEnabled === undefined
        ? "Fund assignment saved."
        : value.account.givingEnabled
          ? "Category enabled."
          : "Category disabled.",
    );
  }

  function openFundModal(account: Account) {
    setSelected(account);
    setFundId(account.givingFundId ?? "");
    setError("");
  }

  async function saveFund(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await update(selected, { givingFundId: fundId || null });
    setSelected(null);
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
          Giving and pledges
        </p>
        <h1 className="mt-2 font-serif text-4xl">Categories</h1>
        <p className="mt-3 max-w-2xl text-ink/60">
          Choose which income categories are available for contributions and
          assign each category to a fund. These settings do not disable accounts
          in the Chart of Accounts.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-teal/10 p-3 text-sm text-teal"
          >
            {notice}
          </p>
        )}
        <section className="mt-8 rounded-2xl border border-ink/10 bg-white shadow-sm">
          <div className="border-b border-ink/10 px-6 py-5">
            <h2 className="text-2xl font-semibold tracking-tight">
              Contribution categories
            </h2>
            <p className="mt-2 text-sm text-ink/60">
              40000 and 60000 account families and their subaccounts.
            </p>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-ink/55">Loading categories…</p>
          ) : (
            <div className="divide-y divide-ink/10">
              {rows.map(({ account, depth, hasChildren }) => (
                <div
                  key={account.id}
                  style={{ marginLeft: `${depth * 1.5}rem` }}
                  className={`flex flex-wrap items-center justify-between gap-4 border-l-2 px-6 py-3 ${account.givingEnabled ? "border-teal/35 bg-mist/50" : "border-ink/15 bg-ink/5 opacity-70"}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-sm font-semibold">
                        {account.code}
                      </span>
                      <span className="text-sm">{account.name}</span>
                      <span
                        className={`text-xs font-semibold ${account.givingEnabled ? "text-teal" : "text-ink/50"}`}
                      >
                        {account.givingEnabled ? "Available" : "Disabled"}
                      </span>
                    </div>
                    {account.givingFundId && (
                      <p className="mt-1 text-xs text-ink/55">
                        Fund:{" "}
                        {funds.find((fund) => fund.id === account.givingFundId)
                          ?.name ?? "Assigned fund"}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={account.onlineGivingEnabled}
                        onChange={() =>
                          void update(account, {
                            onlineGivingEnabled: !account.onlineGivingEnabled,
                          })
                        }
                        className="focus-ring h-4 w-4 accent-coral"
                      />
                      {hasChildren ? "Online giving (all children)" : "Online giving"}
                    </label>
                    {!hasChildren && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => openFundModal(account)}
                      >
                        Assign fund
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void update(account, {
                          givingEnabled: !account.givingEnabled,
                        })
                      }
                    >
                      {account.givingEnabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
              {!rows.length && (
                <p className="p-6 text-sm text-ink/55">
                  No 40000 or 60000 accounts are available.
                </p>
              )}
            </div>
          )}
        </section>
      </Container>
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
          <form
            onSubmit={saveFund}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-fund-title"
          >
            <h2 id="assign-fund-title" className="font-serif text-2xl">
              Assign fund
            </h2>
            <p className="mt-2 text-sm text-ink/60">
              {selected.code} · {selected.name}
            </p>
            <label className="mt-5 grid gap-1 text-sm font-semibold">
              Fund
              <select
                value={fundId}
                onChange={(event) => setFundId(event.target.value)}
                className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
              >
                <option value="">No fund assignment</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.code} · {fund.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-mist"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <Button type="submit">Save Assignment</Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
