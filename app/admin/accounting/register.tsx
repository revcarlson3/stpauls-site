"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type BankAccount = { id: string; name: string; isActive: boolean };
type ChartAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  parentId: string | null;
};
type Fund = { id: string; code: string; name: string; isActive: boolean };
type Contact = { id: string; displayName: string; isActive: boolean };
type Allocation = { accountId: string; fundId: string; amount: string };
type Transaction = {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  paymentMethod: string;
  transactionType: "DEBIT" | "CREDIT";
  entryType: string;
  status: string;
  deletedGivingBatch?: boolean;
  deletedGivingBatchAt?: string | null;
  amount: number;
  bankAccountId: string;
  bankAccount: string;
  destinationBankAccountId: string;
  category: string;
  accountId: string;
  destinationAccountId: string;
  fund: string | null;
  fundId: string;
  destinationFundId: string;
  allocations: Array<{ accountId: string; fundId: string; amount: number }>;
};
type RegisterFilters = {
  bankAccountId: string;
  transactionType: string;
  paymentMethod: string;
  exactDate: string;
  dateFrom: string;
  dateTo: string;
  exactAmount: string;
  amountFrom: string;
  amountTo: string;
};

const inputClass =
  "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const modalButtonClass = "h-10 min-h-0 shrink-0 self-center py-2 leading-5";
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const paymentMethods = [
  ["CHECK", "Check"],
  ["CASH", "Cash"],
  ["DEBIT_CARD", "Debit card"],
  ["ACH", "ACH"],
  ["BILL_PAY", "Bill pay"],
  ["PAYROLL", "Payroll"],
  ["DEP", "Deposit"],
] as const;
const entryTypes = [
  ["STANDARD", "Regular transaction"],
  ["BANK_TRANSFER", "Bank account transfer"],
  ["FUND_TRANSFER", "Fund transfer"],
  ["ACCOUNT_TRANSFER", "Account transfer"],
] as const;
const parentCodeForRegisterAccount = (code: string) => {
  if (!/^\d{5}$/.test(code)) return null;
  if (code.slice(3) !== "00") return `${code.slice(0, 3)}00`;
  if (code.slice(2) !== "000") return `${code.slice(0, 2)}000`;
  if (code.slice(1) !== "0000") return `${code[0]}0000`;
  return null;
};
const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  entryType: "STANDARD",
  bankAccountId: "",
  destinationBankAccountId: "",
  accountId: "",
  destinationAccountId: "",
  fundId: "",
  destinationFundId: "",
  transactionType: "CREDIT",
  paymentMethod: "CASH",
  amount: "",
  contactId: "",
  description: "",
  reference: "",
  allocations: [{ accountId: "", fundId: "", amount: "" }] as Allocation[],
});
const emptyFilters = (): RegisterFilters => ({
  bankAccountId: "",
  transactionType: "",
  paymentMethod: "",
  exactDate: "",
  dateFrom: "",
  dateTo: "",
  exactAmount: "",
  amountFrom: "",
  amountTo: "",
});

export function RegisterFilters() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState(emptyFilters);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    void fetch("/api/accounting/bank-accounts")
      .then((response) => response.json())
      .then((value) => setBankAccounts(value.accounts ?? []))
      .catch(() => setError("Unable to load bank accounts."));
  }, [isOpen]);

  function update(values: Partial<RegisterFilters>) {
    setForm((current) => ({ ...current, ...values }));
  }
  function apply(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
      setError("The start date must be before the end date.");
      return;
    }
    const amounts = [form.exactAmount, form.amountFrom, form.amountTo]
      .filter(Boolean)
      .map(Number);
    if (
      amounts.some((amount) => Number.isNaN(amount) || amount < 0) ||
      (form.amountFrom &&
        form.amountTo &&
        Number(form.amountFrom) > Number(form.amountTo))
    ) {
      setError("Enter a valid non-negative amount range.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("accounting:register-filters-changed", { detail: form }),
    );
    setIsOpen(false);
  }
  function clear() {
    const filters = emptyFilters();
    setForm(filters);
    setError("");
    window.dispatchEvent(
      new CustomEvent("accounting:register-filters-changed", {
        detail: filters,
      }),
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setError("");
          setIsOpen(true);
        }}
      >
        Filter
      </Button>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-filter-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="register-filter-title" className="font-serif text-2xl">
                  Filter register
                </h2>
                <p className="mt-2 text-sm text-ink/60">
                  Narrow the 100 most recent transactions without changing the
                  register.
                </p>
              </div>
              <button
                type="button"
                className="focus-ring rounded-lg px-2 py-1 text-2xl leading-none text-ink/55 hover:bg-ink/5 hover:text-ink"
                onClick={() => setIsOpen(false)}
                aria-label="Close register filters"
              >
                ×
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral"
              >
                {error}
              </p>
            )}
            <form onSubmit={apply} className="mt-5 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">
                Bank account
                <select
                  value={form.bankAccountId}
                  onChange={(event) =>
                    update({ bankAccountId: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">All bank accounts</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Transaction type
                  <select
                    value={form.transactionType}
                    onChange={(event) =>
                      update({ transactionType: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Debit and credit</option>
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Payment method
                  <select
                    value={form.paymentMethod}
                    onChange={(event) =>
                      update({ paymentMethod: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">All methods</option>
                    {paymentMethods.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="grid gap-2 rounded-lg border border-ink/10 p-3">
                <legend className="px-1 text-sm font-semibold">Date</legend>
                <label className="grid gap-1 text-sm">
                  Exact date
                  <input
                    type="date"
                    value={form.exactDate}
                    onChange={(event) =>
                      update({
                        exactDate: event.target.value,
                        dateFrom: "",
                        dateTo: "",
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    From
                    <input
                      type="date"
                      value={form.dateFrom}
                      onChange={(event) =>
                        update({ dateFrom: event.target.value, exactDate: "" })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    To
                    <input
                      type="date"
                      value={form.dateTo}
                      onChange={(event) =>
                        update({ dateTo: event.target.value, exactDate: "" })
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset className="grid gap-2 rounded-lg border border-ink/10 p-3">
                <legend className="px-1 text-sm font-semibold">Amount</legend>
                <label className="grid gap-1 text-sm">
                  Exact amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.exactAmount}
                    onChange={(event) =>
                      update({
                        exactAmount: event.target.value,
                        amountFrom: "",
                        amountTo: "",
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Minimum
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amountFrom}
                      onChange={(event) =>
                        update({
                          amountFrom: event.target.value,
                          exactAmount: "",
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Maximum
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amountTo}
                      onChange={(event) =>
                        update({
                          amountTo: event.target.value,
                          exactAmount: "",
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
              </fieldset>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Button type="button" variant="secondary" onClick={clear}>
                  Clear
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Apply filters</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function Register() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState<RegisterFilters>(emptyFilters);
  const transactionAccounts = chartAccounts.filter(
    (account) =>
      !chartAccounts.some(
        (candidate) =>
          candidate.parentId === account.id ||
          parentCodeForRegisterAccount(candidate.code) === account.code,
      ),
  );

  async function load() {
    const [
      bankResponse,
      accountResponse,
      fundResponse,
      contactResponse,
      registerResponse,
    ] = await Promise.all([
      fetch("/api/accounting/bank-accounts"),
      fetch("/api/accounting/chart-of-accounts"),
      fetch("/api/accounting/funds"),
      fetch("/api/accounting/contacts"),
      fetch("/api/accounting/register"),
    ]);
    const [bankValue, accountValue, fundValue, contactValue, registerValue] =
      await Promise.all([
        bankResponse.json(),
        accountResponse.json(),
        fundResponse.json(),
        contactResponse.json(),
        registerResponse.json(),
      ]);
    if (
      !bankResponse.ok ||
      !accountResponse.ok ||
      !fundResponse.ok ||
      !contactResponse.ok ||
      !registerResponse.ok
    )
      throw new Error(registerValue.error ?? "Unable to load the register.");
    setBankAccounts(bankValue.accounts ?? []);
    setChartAccounts(accountValue.accounts ?? []);
    setFunds(fundValue.funds ?? []);
    setContacts(contactValue.contacts ?? []);
    setTransactions(registerValue.transactions ?? []);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
    const refreshAccounts = () => {
      void load().catch((reason: Error) => setError(reason.message));
    };
    window.addEventListener("accounting:accounts-changed", refreshAccounts);
    const updateFilters = (event: Event) =>
      setFilters((event as CustomEvent<RegisterFilters>).detail);
    window.addEventListener(
      "accounting:register-filters-changed",
      updateFilters,
    );
    return () => {
      window.removeEventListener(
        "accounting:accounts-changed",
        refreshAccounts,
      );
      window.removeEventListener(
        "accounting:register-filters-changed",
        updateFilters,
      );
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModalOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isModalOpen]);

  function openNew() {
    setSelectedId(null);
    setForm(emptyForm());
    setError("");
    setNotice("");
    setIsModalOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setSelectedId(transaction.id);
    setForm({
      date: transaction.date.slice(0, 10),
      entryType: transaction.entryType,
      bankAccountId: transaction.bankAccountId,
      destinationBankAccountId: transaction.destinationBankAccountId,
      accountId: transaction.accountId,
      destinationAccountId: transaction.destinationAccountId,
      fundId: transaction.fundId,
      destinationFundId: transaction.destinationFundId,
      transactionType: transaction.transactionType,
      paymentMethod: transaction.paymentMethod,
      amount:
        transaction.entryType === "STANDARD"
          ? transaction.amount.toFixed(2)
          : Math.abs(transaction.amount).toFixed(2),
      contactId:
        contacts.find(
          (contact) =>
            contact.displayName.toLocaleLowerCase() ===
            transaction.description.toLocaleLowerCase(),
        )?.id ?? "",
      description: transaction.description,
      reference: transaction.reference ?? "",
      allocations: transaction.allocations.map((allocation) => ({
        ...allocation,
        amount: allocation.amount.toFixed(2),
      })),
    });
    setError("");
    setNotice("");
    setIsModalOpen(true);
  }

  async function saveTransaction(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const response = await fetch(
      selectedId
        ? `/api/accounting/register/${selectedId}`
        : "/api/accounting/register",
      {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to save the transaction.");
      return;
    }
    setIsModalOpen(false);
    setNotice(selectedId ? "Transaction updated." : "Transaction posted.");
    await load();
  }

  async function deleteTransaction() {
    if (
      !selectedId ||
      !window.confirm(
        "Delete this transaction? This permanently removes its journal entry.",
      )
    )
      return;
    setError("");
    const response = await fetch(`/api/accounting/register/${selectedId}`, {
      method: "DELETE",
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to delete the transaction.");
      return;
    }

    setIsModalOpen(false);
    setSelectedId(null);
    setNotice("Transaction deleted.");
    await load();
  }

  async function approveTransaction(transaction: Transaction) {
    setError("");
    const response = await fetch(`/api/accounting/register/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to approve the transaction.");
      return;
    }
    setNotice("Deposit approved and added to the journal.");
    await load();
  }

  async function denyTransaction(transaction: Transaction) {
    const note = window.prompt(
      "Why are you denying this contribution batch deposit? This note will be included in the notification to Giving managers.",
      "",
    );
    if (note === null) return;
    if (
      !window.confirm(
        "Deny this contribution batch deposit? The transaction will not be recorded and the batch will return to Giving as unposted.",
      )
    )
      return;
    setError("");
    const response = await fetch(`/api/accounting/register/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deny", note: note.trim().slice(0, 500) }),
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to deny the transaction.");
      return;
    }
    setIsModalOpen(false);
    setSelectedId(null);
    setNotice("Deposit denied and returned to Giving as unposted.");
    await load();
  }

  const isStandard = form.entryType === "STANDARD";
  const isBankTransfer = form.entryType === "BANK_TRANSFER";
  const isFundTransfer = form.entryType === "FUND_TRANSFER";
  const isAccountTransfer = form.entryType === "ACCOUNT_TRANSFER";
  const selectedTransaction = selectedId
    ? transactions.find((transaction) => transaction.id === selectedId)
    : null;
  const isPendingTransaction = selectedTransaction?.status === "PENDING";
  const filteredTransactions = transactions.filter((transaction) => {
    const date = transaction.date.slice(0, 10);
    const amount = Math.round(Math.abs(transaction.amount) * 100);
    const exactAmount = filters.exactAmount
      ? Math.round(Number(filters.exactAmount) * 100)
      : null;
    const amountFrom = filters.amountFrom
      ? Math.round(Number(filters.amountFrom) * 100)
      : null;
    const amountTo = filters.amountTo
      ? Math.round(Number(filters.amountTo) * 100)
      : null;
    const type = transaction.amount < 0 ? "DEBIT" : "CREDIT";
    return (
      (!filters.bankAccountId ||
        transaction.bankAccountId === filters.bankAccountId) &&
      (!filters.transactionType || type === filters.transactionType) &&
      (!filters.paymentMethod ||
        transaction.paymentMethod === filters.paymentMethod) &&
      (!filters.exactDate || date === filters.exactDate) &&
      (!filters.dateFrom || date >= filters.dateFrom) &&
      (!filters.dateTo || date <= filters.dateTo) &&
      (exactAmount === null || amount === exactAmount) &&
      (amountFrom === null || amount >= amountFrom) &&
      (amountTo === null || amount <= amountTo)
    );
  });

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-serif text-2xl">Register activity</h2>
          <p className="mt-1 max-w-xl text-sm text-ink/60">
            Click a transaction to edit it. Transfers can move cash, reclassify
            funds, or reclassify accounts without moving money.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          New transaction
        </Button>
      </div>
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
      <section className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <div className="border-b border-ink/10 px-6 py-5">
          <h2 className="font-serif text-2xl">Recent transactions</h2>
          <p className="mt-1 text-sm text-ink/60">
            {filteredTransactions.length} of {transactions.length} recent
            transaction{transactions.length === 1 ? "" : "s"} shown. Select a
            row to edit or delete it.
          </p>
        </div>
        {filteredTransactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-mist/60 text-xs uppercase tracking-[0.12em] text-ink/55">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Method</th>
                  <th className="px-6 py-3 font-semibold">Account</th>
                  <th className="px-6 py-3 font-semibold">
                    Category / transfer
                  </th>
                  <th className="px-6 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => openEdit(transaction)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        openEdit(transaction);
                    }}
                    className={`cursor-pointer border-t border-ink/10 hover:bg-mist/35 focus:bg-mist/35 focus:outline-none ${transaction.status === "PENDING" ? "bg-amber-50/70" : ""}`}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-ink/65">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold">{transaction.description}</p>
                      {transaction.deletedGivingBatch && (
                        <p className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                          Giving batch deleted
                        </p>
                      )}
                      {transaction.status === "PENDING" && (
                        <button
                          type="button"
                          className="focus-ring mt-2 rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white hover:bg-coral/85"
                          onClick={(event) => {
                            event.stopPropagation();
                            void approveTransaction(transaction);
                          }}
                        >
                          Approve
                        </button>
                      )}
                      {transaction.reference && (
                        <p className="mt-1 text-xs text-ink/55">
                          Ref. {transaction.reference}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {transaction.entryType === "STANDARD"
                        ? transaction.amount < 0
                          ? "Debit"
                          : "Credit"
                        : entryTypes.find(
                            ([value]) => value === transaction.entryType,
                          )?.[1]}
                    </td>
                    <td className="px-6 py-4 text-ink/70">
                      {transaction.entryType === "STANDARD"
                        ? (paymentMethods.find(
                            ([value]) => value === transaction.paymentMethod,
                          )?.[1] ?? transaction.paymentMethod)
                        : "Transfer"}
                    </td>
                    <td className="px-6 py-4 text-ink/70">
                      {transaction.bankAccount}
                    </td>
                    <td className="px-6 py-4 text-ink/70">
                      {transaction.category}
                      {transaction.entryType === "BANK_TRANSFER" &&
                      transaction.destinationBankAccountId ? (
                        <span className="mt-1 block text-xs text-ink/50">
                          →{" "}
                          {bankAccounts.find(
                            (account) =>
                              account.id ===
                              transaction.destinationBankAccountId,
                          )?.name ?? "destination account"}
                        </span>
                      ) : null}
                      {transaction.fund ? (
                        <span className="mt-1 block text-xs text-ink/50">
                          {transaction.fund}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`whitespace-nowrap px-6 py-4 text-right font-semibold ${transaction.amount < 0 ? "text-coral" : "text-teal"}`}
                    >
                      {transaction.amount < 0 ? "−" : "+"}
                      {currency.format(Math.abs(transaction.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-semibold">No matching transactions</p>
            <p className="mt-1 text-sm text-ink/60">
              {transactions.length
                ? "Try clearing one or more filters."
                : "Use New transaction to post the first entry."}
            </p>
          </div>
        )}
      </section>
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full     max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="transaction-title" className="font-serif text-2xl">
                  {selectedId ? "Edit transaction" : "New transaction"}
                </h2>
                <p className="mt-2 text-sm text-ink/60">
                  Choose a regular transaction or a transfer between bank
                  accounts, funds, or accounts.
                </p>
              </div>
              <button
                type="button"
                className="focus-ring rounded-lg px-2 py-1 text-2xl leading-none text-ink/55 hover:bg-ink/5 hover:text-ink"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close transaction dialog"
              >
                ×
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral"
              >
                {error}
              </p>
            )}
            <form
              onSubmit={(event) => {
                if (isPendingTransaction) {
                  event.preventDefault();
                  if (selectedTransaction) void approveTransaction(selectedTransaction);
                  return;
                }
                void saveTransaction(event);
              }}
              className="mt-5 grid gap-3"
            >
              <fieldset disabled={isPendingTransaction} className="contents">
              <label className="grid gap-1 text-sm font-semibold">
                Entry type
                <select
                  value={form.entryType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      entryType: event.target.value,
                      paymentMethod:
                        event.target.value === "STANDARD" ? "CASH" : "TRANSFER",
                    })
                  }
                  className={inputClass}
                >
                  {entryTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {isStandard && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold">
                    Date
                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm({ ...form, date: event.target.value })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Transaction type
                    <select
                      value={form.transactionType}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          transactionType: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="CREDIT">Credit — adds to balance</option>
                      <option value="DEBIT">Debit — reduces balance</option>
                    </select>
                  </label>
                </div>
              )}
              {!isStandard && (
                <label className="grid gap-1 text-sm font-semibold">
                  Date
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              )}
              {isStandard && (
                <label className="grid gap-1 text-sm font-semibold">
                  Payment method
                  <select
                    required
                    value={form.paymentMethod}
                    onChange={(event) =>
                      setForm({ ...form, paymentMethod: event.target.value })
                    }
                    className={inputClass}
                  >
                    {paymentMethods.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isBankTransfer && (
                <>
                  <label className="grid gap-1 text-sm font-semibold">
                    From bank account
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={(event) =>
                        setForm({ ...form, bankAccountId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select source account</option>
                      {bankAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    To bank account
                    <select
                      required
                      value={form.destinationBankAccountId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          destinationBankAccountId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select destination account</option>
                      {bankAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {isFundTransfer && (
                <>
                  <label className="grid gap-1 text-sm font-semibold">
                    Bank or cash account
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={(event) =>
                        setForm({ ...form, bankAccountId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select account</option>
                      {bankAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    From fund
                    <select
                      required
                      value={form.fundId}
                      onChange={(event) =>
                        setForm({ ...form, fundId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select source fund</option>
                      {funds
                        .filter((fund) => fund.isActive)
                        .map((fund) => (
                          <option key={fund.id} value={fund.id}>
                            {fund.code} · {fund.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    To fund
                    <select
                      required
                      value={form.destinationFundId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          destinationFundId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select destination fund</option>
                      {funds
                        .filter((fund) => fund.isActive)
                        .map((fund) => (
                          <option key={fund.id} value={fund.id}>
                            {fund.code} · {fund.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {isAccountTransfer && (
                <>
                  <label className="grid gap-1 text-sm font-semibold">
                    Bank or cash account
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={(event) =>
                        setForm({ ...form, bankAccountId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select account</option>
                      {bankAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    From account
                    <select
                      required
                      value={form.accountId}
                      onChange={(event) =>
                        setForm({ ...form, accountId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select source account</option>
                      {transactionAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} · {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    To account
                    <select
                      required
                      value={form.destinationAccountId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          destinationAccountId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select destination account</option>
                      {transactionAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} · {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}{" "}
              {isStandard && (
                <>
                  <label className="grid gap-1 text-sm font-semibold">
                    Bank or cash account
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={(event) =>
                        setForm({ ...form, bankAccountId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select an account</option>
                      {bankAccounts
                        .filter((account) => account.isActive)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <fieldset className="grid gap-2 rounded-lg   border border-ink/10 bg-mist/50 p-3 sm:col-span-2">
                    <legend className="px-1 text-sm font-semibold">
                      Transaction items
                    </legend>
                    <div className="hidden grid-cols-[1fr_1fr_8rem_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink/45 sm:grid">
                      <span>Category</span>
                      <span>Fund</span>
                      <span>Amount</span>
                      <span />
                    </div>
                    {form.allocations.map((allocation, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-lg border border-ink/10 p-2 sm:grid-cols-[1fr_1fr_8rem_2.5rem] sm:border-0 sm:p-0"
                      >
                        <select
                          required
                          aria-label={`Item ${index + 1} category`}
                          value={allocation.accountId}
                          onChange={(event) => {
                            const allocations = [...form.allocations];
                            allocations[index] = {
                              ...allocation,
                              accountId: event.target.value,
                            };
                            setForm({ ...form, allocations });
                          }}
                          className={inputClass}
                        >
                          <option value="">Select category</option>
                          {transactionAccounts
                            .filter((account) => account.isActive)
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.code} · {account.name}
                              </option>
                            ))}
                        </select>
                        <select
                          aria-label={`Item ${index + 1} fund`}
                          value={allocation.fundId}
                          onChange={(event) => {
                            const allocations = [...form.allocations];
                            allocations[index] = {
                              ...allocation,
                              fundId: event.target.value,
                            };
                            setForm({ ...form, allocations });
                          }}
                          className={inputClass}
                        >
                          <option value="">No fund</option>
                          {funds
                            .filter((fund) => fund.isActive)
                            .map((fund) => (
                              <option key={fund.id} value={fund.id}>
                                {fund.code} · {fund.name}
                              </option>
                            ))}
                        </select>
                        <input
                          required
                          aria-label={`Item ${index + 1} amount`}
                          type="text"
                          inputMode="decimal"
                          value={allocation.amount}
                          onChange={(event) => {
                            const allocations = [...form.allocations];
                            allocations[index] = {
                              ...allocation,
                              amount: event.target.value,
                            };
                            setForm({ ...form, allocations });
                          }}
                          className={inputClass}
                          placeholder="0.00"
                        />
                        <button
                          type="button"
                          className="focus-ring rounded-lg text-coral disabled:opacity-30"
                          disabled={form.allocations.length === 1}
                          onClick={() =>
                            setForm({
                              ...form,
                              allocations: form.allocations.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                          aria-label={`Remove item ${index + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="justify-self-start text-sm font-semibold text-coral hover:underline"
                      onClick={() =>
                        setForm({
                          ...form,
                          allocations: [
                            ...form.allocations,
                            { accountId: "", fundId: "", amount: "" },
                          ],
                        })
                      }
                    >
                      + Add item
                    </button>
                    <p className="text-xs text-ink/55">
                      Item amounts must add up to the transaction amount.
                    </p>
                  </fieldset>
                </>
              )}
              <label className="grid gap-1 text-sm font-semibold">
                Amount
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  className={inputClass}
                  placeholder={
                    isStandard && form.transactionType === "DEBIT"
                      ? "-0.00"
                      : "+0.00"
                  }
                />
                <span className="text-xs font-normal text-ink/55">
                  {isStandard
                    ? "Without a sign, debit reduces and credit adds. Use + or − to override."
                    : "Enter the amount to transfer."}
                </span>
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                {" "}
                Payee/Description
                <select
                  required
                  value={form.contactId || "__manual"}
                  onChange={(event) => {
                    const contactId =
                      event.target.value === "__manual"
                        ? ""
                        : event.target.value;
                    const contact = contacts.find(
                      (item) => item.id === contactId,
                    );
                    setForm({
                      ...form,
                      contactId,
                      description: contact?.displayName ?? "",
                    });
                  }}
                  className={inputClass}
                >
                  <option value="__manual">Enter manually</option>
                  {contacts
                    .filter((contact) => contact.isActive)
                    .map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.displayName}
                      </option>
                    ))}
                </select>
                {(!form.contactId ||
                  !contacts.some(
                    (contact) =>
                      contact.id === form.contactId && contact.isActive,
                  )) && (
                  <input
                    required
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        contactId: "",
                        description: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder={
                      isBankTransfer
                        ? "Transfer to checking"
                        : isFundTransfer
                          ? "Correct fund allocation"
                          : isAccountTransfer
                            ? "Reclassify housing allowance"
                            : "Sunday offering"
                    }
                  />
                )}
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Reference{" "}
                <span className="font-normal text-ink/50">(optional)</span>
                <input
                  value={form.reference}
                  onChange={(event) =>
                    setForm({ ...form, reference: event.target.value })
                  }
                  className={inputClass}
                  placeholder="Check number or approval"
                />
              </label>
              </fieldset>
              <div className="mt-3 flex justify-between gap-3">
                {isPendingTransaction && selectedTransaction ? (
                  <Button
                    type="button"
                    className={`${modalButtonClass} bg-coral text-white`}
                    onClick={() => void denyTransaction(selectedTransaction)}
                  >
                    Deny
                  </Button>
                ) : selectedId ? (
                  <Button
                    type="button"
                    className={`${modalButtonClass} bg-coral text-white`}
                    onClick={deleteTransaction}
                  >
                    Delete transaction
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className={modalButtonClass}
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className={modalButtonClass}>
                    {isPendingTransaction && selectedTransaction
                      ? "Approve"
                      : selectedId
                        ? "Save changes"
                        : "Post transaction"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
