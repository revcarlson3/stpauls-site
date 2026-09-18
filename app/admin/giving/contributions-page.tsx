"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Container } from "@/components/ui";

type Batch = {
  id: string;
  date: string;
  description?: string | null;
  isPosted: boolean;
  depositStatus: "UNPOSTED" | "PENDING" | "POSTED";
};
type Category = { id: string; code: string; name: string };
type BankAccount = { id: string; name: string };
type Member = { id: string; name: string; envelopeNumber: string | null };
type ContributionRow = {
  memberId: string;
  memberName: string;
  amount: string;
  categoryId: string;
  deductible: boolean;
  paymentType: string;
  checkNumber: string;
  memo: string;
};

const PAYMENT_TYPES = ["CASH", "CHECK", "CARD", "ACH", "TEXT", "OTHER"];
const emptyRow = (): ContributionRow => ({
  memberId: "",
  memberName: "",
  amount: "",
  categoryId: "",
  deductible: true,
  paymentType: "CASH",
  checkNumber: "",
  memo: "",
});

export function ContributionsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postingBankAccountId, setPostingBankAccountId] = useState("");
  const [postingMemo, setPostingMemo] = useState("");
  const [dateModalMode, setDateModalMode] = useState<"new" | "edit">("new");
  const [batchDate, setBatchDate] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [rows, setRows] = useState<ContributionRow[]>([
    emptyRow(),
    emptyRow(),
    emptyRow(),
  ]);
  const [memberSearch, setMemberSearch] = useState<Record<number, string>>({});
  const [memberOptions, setMemberOptions] = useState<Record<number, Member[]>>(
    {},
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    void fetch("/api/giving/contributions")
      .then((response) => response.json())
      .then((value) => {
        setBatches(value.batches ?? []);
        setCategories(value.categories ?? []);
        setBankAccounts(value.bankAccounts ?? []);
      })
      .catch(() => setMessage("Unable to load contribution data."));
  }, []);

  useEffect(() => {
    if (!actionsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !actionsMenuRef.current?.contains(event.target)
      )
        setActionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsOpen]);

  function beginAdd() {
    setDateModalOpen(true);
    setDateModalMode("new");
    setSelectedBatchId(null);
    setIsAdding(false);
    setEditingBatchId(null);
    setBatchDescription("");
    setMessage("");
    if (!batchDate) {
      const today = new Date();
      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }

  function beginEditDateDescription() {
    const batch = batches.find((item) => item.id === selectedBatchId);
    if (!batch || batch.isPosted) return;
    const date = String(batch.date).slice(0, 10);
    setBatchDate(date);
    setBatchDescription(batch.description ?? "");
    setCalendarMonth(new Date(`${date}T00:00:00`));
    setDateModalMode("edit");
    setDateModalOpen(true);
    setActionsOpen(false);
    setMessage("");
  }

  function beginDeleteBatch() {
    if (!selectedBatchId) return;
    setDeleteModalOpen(true);
    setActionsOpen(false);
    setMessage("");
  }

  function beginPostBatch(batchId: string) {
    setSelectedBatchId(batchId);
    setPostingBankAccountId("");
    setPostingMemo("");
    setPostModalOpen(true);
    setActionsOpen(false);
    setMessage("");
  }

  async function confirmPostBatch() {
    if (!selectedBatchId || !postingBankAccountId) return;
    const response = await fetch("/api/giving/contributions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "post",
        batchId: selectedBatchId,
        bankAccountId: postingBankAccountId,
        memo: postingMemo,
      }),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(value.error ?? "Unable to post contribution batch.");
      setPostModalOpen(false);
      return;
    }
    const refreshed = await fetch("/api/giving/contributions").then((result) =>
      result.json(),
    );
    setBatches(refreshed.batches ?? []);
    setPostModalOpen(false);
    setMessage("Contribution batch posted.");
  }

  async function confirmDeleteBatch() {
    if (!selectedBatchId) return;
    const response = await fetch("/api/giving/contributions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: selectedBatchId }),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(value.error ?? "Unable to delete contribution batch.");
      setDeleteModalOpen(false);
      return;
    }
    const refreshed = await fetch("/api/giving/contributions").then((result) =>
      result.json(),
    );
    setBatches(refreshed.batches ?? []);
    setSelectedBatchId(null);
    setIsAdding(false);
    setEditingBatchId(null);
    setDeleteModalOpen(false);
    setMessage("Contribution batch deleted.");
  }

  async function editBatch() {
    if (
      !selectedBatchId ||
      batches.find((batch) => batch.id === selectedBatchId)?.isPosted
    )
      return;
    const response = await fetch(
      `/api/giving/contributions?batchId=${encodeURIComponent(selectedBatchId)}`,
    );
    const value = await response.json();
    if (!response.ok || !value.selectedBatch) {
      setMessage(value.error ?? "Unable to load contribution batch.");
      return;
    }
    setBatchDate(String(value.selectedBatch.date).slice(0, 10));
    setRows(
      value.selectedBatch.contributions.length >= 3
        ? value.selectedBatch.contributions
        : [
            ...value.selectedBatch.contributions,
            ...Array.from(
              { length: 3 - value.selectedBatch.contributions.length },
              emptyRow,
            ),
          ],
    );
    setEditingBatchId(selectedBatchId);
    setIsAdding(true);
    setActionsOpen(false);
  }

  function selectCalendarDate(day: number) {
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, "0");
    setBatchDate(`${year}-${month}-${String(day).padStart(2, "0")}`);
  }

  function confirmDate() {
    if (!batchDate) return;
    if (dateModalMode === "edit") {
      void saveBatchDetails();
      return;
    }
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setIsAdding(true);
    setDateModalOpen(false);
  }

  async function saveBatchDetails() {
    if (!selectedBatchId || !batchDate) return;
    const response = await fetch("/api/giving/contributions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: selectedBatchId,
        batchDate,
        description: batchDescription,
      }),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(value.error ?? "Unable to update batch details.");
      return;
    }
    const refreshed = await fetch("/api/giving/contributions").then((result) =>
      result.json(),
    );
    setBatches(refreshed.batches ?? []);
    setDateModalOpen(false);
    setMessage("Batch details updated.");
  }

  function updateRow(index: number, value: Partial<ContributionRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...value } : row,
      ),
    );
    if (
      index === rows.length - 1 &&
      (value.memberId || value.amount || value.categoryId || value.memo)
    )
      setRows((current) => [...current, emptyRow()]);
  }

  async function searchMembers(index: number, search: string) {
    setMemberSearch((current) => ({ ...current, [index]: search }));
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, memberId: "", memberName: "" } : row,
      ),
    );
    const validSearch = search.length >= 3 || /^\d+$/.test(search);
    if (!validSearch) {
      setMemberOptions((current) => ({ ...current, [index]: [] }));
      return;
    }
    const response = await fetch(
      `/api/giving/contributions?search=${encodeURIComponent(search)}`,
    );
    const value = await response.json();
    setMemberOptions((current) => ({
      ...current,
      [index]: value.members ?? [],
    }));
  }

  async function saveBatch() {
    const payloadRows = rows.filter(
      (row) => row.amount || row.memberId || row.categoryId,
    );
    if (
      !batchDate ||
      !payloadRows.length ||
      payloadRows.some((row) => !row.amount || !row.categoryId)
    ) {
      setMessage(
        "Enter a date, amount, and category for each contribution row you are using.",
      );
      return;
    }
    const response = await fetch("/api/giving/contributions", {
      method: editingBatchId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingBatchId ? { batchId: editingBatchId } : {}),
        batchDate,
        contributions: payloadRows.map((row) => ({
          memberId: row.memberId || null,
          amount: Number(row.amount),
          categoryId: row.categoryId,
          deductible: row.deductible,
          paymentType: row.paymentType,
          checkNumber: row.checkNumber,
          memo: row.memo,
        })),
      }),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(value.error ?? "Unable to save contribution batch.");
      return;
    }
    setMessage("Contribution batch saved.");
    const refreshed = await fetch("/api/giving/contributions").then((result) =>
      result.json(),
    );
    setBatches(refreshed.batches ?? []);
    setIsAdding(false);
    setEditingBatchId(null);
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
          Giving and pledges
        </p>
        <h1 className="mt-2 font-serif text-4xl">Contributions</h1>
        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral"
          >
            {message}
          </p>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={beginAdd}>
                <span aria-hidden="true" className="mr-2 text-lg leading-none">
                  +
                </span>
                Add
              </Button>
              <div ref={actionsMenuRef} className="relative">
                <button
                  type="button"
                  disabled={!selectedBatchId}
                  aria-expanded={actionsOpen}
                  className="focus-ring inline-flex items-center rounded-full border border-ink/15 px-4 py-3 text-sm font-semibold text-ink transition hover:border-coral hover:text-coral disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => setActionsOpen((open) => !open)}
                >
                  Actions{" "}
                  <span aria-hidden="true" className="ml-2">
                    ⌄
                  </span>
                </button>
                {actionsOpen && selectedBatchId && (
                  <div className="absolute left-0 top-full z-20 mt-2 grid min-w-52 gap-1 rounded-xl border border-ink/10 bg-white p-2 text-sm shadow-lg">
                    <button
                      type="button"
                      disabled={
                        batches.find((batch) => batch.id === selectedBatchId)
                          ?.isPosted
                      }
                      className="focus-ring rounded-lg px-3 py-2 text-left hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => void editBatch()}
                    >
                      Edit Batch
                    </button>
                    <button
                      type="button"
                      disabled={
                        batches.find((batch) => batch.id === selectedBatchId)
                          ?.isPosted
                      }
                      className="focus-ring rounded-lg px-3 py-2 text-left hover:bg-mist disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={beginEditDateDescription}
                    >
                      Edit Date/Description
                    </button>
                    <button
                      type="button"
                      className="focus-ring rounded-lg px-3 py-2 text-left hover:bg-mist"
                      onClick={beginDeleteBatch}
                    >
                      Delete Batch
                    </button>
                    {["Create Deposit", "Export to CSV", "Lock Batch"].map(
                      (action) => (
                        <button
                          key={action}
                          type="button"
                          className="focus-ring rounded-lg px-3 py-2 text-left hover:bg-mist"
                          disabled={
                            action === "Create Deposit" &&
                            batches.find(
                              (batch) => batch.id === selectedBatchId,
                            )?.isPosted
                          }
                          onClick={
                            action === "Create Deposit"
                              ? () => {
                                  if (selectedBatchId)
                                    beginPostBatch(selectedBatchId);
                                }
                              : undefined
                          }
                        >
                          {action}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
              <div className="border-b border-ink/10 px-4 py-3">
                <h2 className="font-semibold">Contribution batches</h2>
                <p className="mt-1 text-xs text-ink/55">Most recent first</p>
              </div>
              {batches.length ? (
                <div className="divide-y divide-ink/10">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className={`flex items-center gap-2 px-4 py-3 text-sm hover:bg-mist ${selectedBatchId === batch.id ? "bg-mist font-semibold text-coral" : ""}`}
                    >
                      <button
                        type="button"
                        className="focus-ring min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedBatchId(batch.id);
                          setIsAdding(false);
                          setEditingBatchId(null);
                          setActionsOpen(false);
                        }}
                      >
                        {new Date(batch.date).toLocaleDateString()}
                        <span className="mt-1 block text-xs font-normal text-ink/55">
                          {batch.description ?? "Contribution batch"}
                        </span>
                      </button>
                      {batch.depositStatus === "PENDING" ? (
                        <span
                          className="text-xs font-semibold text-ink/55"
                          title="Pending accounting approval"
                        >
                          Pending
                        </span>
                      ) : batch.isPosted ? (
                        <span
                          className="text-lg font-semibold text-teal"
                          title="Posted"
                          aria-label="Posted"
                        >
                          ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="focus-ring rounded px-2 py-1 text-xs font-semibold text-coral hover:bg-white"
                          onClick={() => beginPostBatch(batch.id)}
                        >
                          Post
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-sm leading-6 text-ink/55">
                  No contribution batches have been created yet.
                </p>
              )}
              <div className="flex items-center justify-between border-t border-ink/10 px-4 py-3 text-xs text-ink/50">
                <span>Page 1</span>
                <span>10 per page</span>
              </div>
            </div>
          </section>
          <section className="lg:col-span-9">
            {isAdding ? (
              <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
                  New batch ·{" "}
                  {new Date(`${batchDate}T00:00:00`).toLocaleDateString()}
                </p>
                <h2 className="mt-2 font-serif text-3xl">Add contributions</h2>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink/15 text-xs uppercase tracking-wider text-ink/55">
                        {[
                          "Name",
                          "Amount",
                          "Category",
                          "Deductable",
                          "Type",
                          "Check #",
                          "Memo",
                        ].map((heading) => (
                          <th key={heading} className="px-3 py-3 font-semibold">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr
                          key={index}
                          className="border-b border-ink/10 align-top"
                        >
                          <td className="relative px-3 py-3">
                            <input
                              value={memberSearch[index] ?? row.memberName}
                              onChange={(event) =>
                                void searchMembers(index, event.target.value)
                              }
                              placeholder="Last name or envelope #"
                              className="focus-ring w-44 rounded-lg border border-ink/15 px-2 py-2 text-sm"
                            />
                            {memberOptions[index]?.length > 0 && (
                              <div className="absolute left-3 top-14 z-30 grid w-60 rounded-lg border border-ink/10 bg-white p-1 shadow-lg">
                                {memberOptions[index].map((member) => (
                                  <button
                                    key={member.id}
                                    type="button"
                                    className="focus-ring rounded px-2 py-2 text-left text-sm hover:bg-mist"
                                    onClick={() => {
                                      updateRow(index, {
                                        memberId: member.id,
                                        memberName: member.name,
                                      });
                                      setMemberSearch((current) => ({
                                        ...current,
                                        [index]: member.name,
                                      }));
                                      setMemberOptions((current) => ({
                                        ...current,
                                        [index]: [],
                                      }));
                                    }}
                                  >
                                    {member.name}
                                    <span className="block text-xs text-ink/50">
                                      {member.envelopeNumber
                                        ? `Envelope ${member.envelopeNumber}`
                                        : "No envelope number"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              inputMode="decimal"
                              value={row.amount}
                              onChange={(event) =>
                                updateRow(index, { amount: event.target.value })
                              }
                              className="focus-ring w-24 rounded-lg border border-ink/15 px-2 py-2 text-right"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={row.categoryId}
                              onChange={(event) =>
                                updateRow(index, {
                                  categoryId: event.target.value,
                                })
                              }
                              className="focus-ring w-52 rounded-lg border border-ink/15 px-2 py-2"
                            >
                              <option value="">Select category</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.code} · {category.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.deductible}
                              onChange={(event) =>
                                updateRow(index, {
                                  deductible: event.target.checked,
                                })
                              }
                              aria-label={`Deductable for row ${index + 1}`}
                              className="mt-3 h-4 w-4 accent-coral"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={row.paymentType}
                              onChange={(event) =>
                                updateRow(index, {
                                  paymentType: event.target.value,
                                  checkNumber:
                                    event.target.value === "CHECK"
                                      ? row.checkNumber
                                      : "",
                                })
                              }
                              className="focus-ring w-28 rounded-lg border border-ink/15 px-2 py-2"
                            >
                              {PAYMENT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type === "ACH"
                                    ? "ACH"
                                    : type.charAt(0) +
                                      type.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={row.checkNumber}
                              disabled={row.paymentType !== "CHECK"}
                              onChange={(event) =>
                                updateRow(index, {
                                  checkNumber: event.target.value,
                                })
                              }
                              className="focus-ring w-24 rounded-lg border border-ink/15 px-2 py-2 disabled:bg-mist/40"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={row.memo}
                              onChange={(event) =>
                                updateRow(index, { memo: event.target.value })
                              }
                              className="focus-ring w-40 rounded-lg border border-ink/15 px-2 py-2"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex justify-end gap-4">
                  {message && (
                    <p className="self-center text-sm text-coral">{message}</p>
                  )}
                  <Button type="button" onClick={() => void saveBatch()}>
                    Save Batch
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-2xl border border-ink/10 bg-white p-6 text-center shadow-sm">
                <div>
                  <h2 className="font-serif text-2xl">
                    {selectedBatchId
                      ? "Contribution batch"
                      : "Select a contribution batch"}
                  </h2>
                  <p className="mt-2 text-sm text-ink/60">
                    {selectedBatchId
                      ? "Contributions will be organized by giver last name here."
                      : "Choose a batch from the list, or select Add to create a new one."}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </Container>
      {dateModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-date-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="batch-date-title" className="font-serif text-2xl">
              {dateModalMode === "edit"
                ? "Edit batch details"
                : "New contribution batch"}
            </h2>
            <p className="mt-2 text-sm text-ink/60">
              {dateModalMode === "edit"
                ? "Update the date or add a special description for this batch."
                : "Choose the date for this batch."}
            </p>
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  className="focus-ring rounded-full px-3 py-2 text-lg text-ink/60 hover:bg-mist"
                  onClick={() =>
                    setCalendarMonth(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          current.getMonth() - 1,
                          1,
                        ),
                    )
                  }
                >
                  ‹
                </button>
                <h3 className="font-semibold">
                  {calendarMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <button
                  type="button"
                  aria-label="Next month"
                  className="focus-ring rounded-full px-3 py-2 text-lg text-ink/60 hover:bg-mist"
                  onClick={() =>
                    setCalendarMonth(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          current.getMonth() + 1,
                          1,
                        ),
                    )
                  }
                >
                  ›
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-ink/45">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <span key={day} className="py-2">
                      {day}
                    </span>
                  ),
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from(
                  {
                    length: new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth(),
                      1,
                    ).getDay(),
                  },
                  (_, index) => (
                    <span key={`empty-${index}`} />
                  ),
                )}
                {Array.from(
                  {
                    length: new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() + 1,
                      0,
                    ).getDate(),
                  },
                  (_, index) => {
                    const day = index + 1;
                    const dateValue = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    return (
                      <button
                        key={dateValue}
                        type="button"
                        aria-pressed={batchDate === dateValue}
                        className={`focus-ring rounded-lg py-2 text-sm hover:bg-mist ${batchDate === dateValue ? "bg-coral font-semibold text-white hover:bg-coral" : ""}`}
                        onClick={() => selectCalendarDate(day)}
                      >
                        {day}
                      </button>
                    );
                  },
                )}
              </div>
              <p className="mt-3 text-center text-sm text-ink/55">
                {batchDate
                  ? new Date(`${batchDate}T00:00:00`).toLocaleDateString()
                  : "Select a date"}
              </p>
            </div>
            {dateModalMode === "edit" && (
              <label className="mt-5 block text-sm font-semibold text-ink">
                Special batch description
                <input
                  value={batchDescription}
                  onChange={(event) => setBatchDescription(event.target.value)}
                  maxLength={120}
                  placeholder="Optional description"
                  className="focus-ring mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal"
                />
              </label>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-mist"
                onClick={() => setDateModalOpen(false)}
              >
                Cancel
              </button>
              <Button type="button" disabled={!batchDate} onClick={confirmDate}>
                {dateModalMode === "edit" ? "Save Changes" : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-batch-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="delete-batch-title" className="font-serif text-2xl">
              Delete contribution batch?
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              This will permanently delete the selected batch and all of its
              contributions. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-mist"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <Button type="button" onClick={() => void confirmDeleteBatch()}>
                Delete Batch
              </Button>
            </div>
          </div>
        </div>
      )}
      {postModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-batch-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="post-batch-title" className="font-serif text-2xl">
              Post contribution batch
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Select the bank account where these funds will be deposited.
            </p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-semibold">
                Deposit account
                <select
                  value={postingBankAccountId}
                  onChange={(event) =>
                    setPostingBankAccountId(event.target.value)
                  }
                  className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Final memo
                <input
                  value={postingMemo}
                  onChange={(event) => setPostingMemo(event.target.value)}
                  maxLength={80}
                  placeholder="Optional memo"
                  className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-mist"
                onClick={() => setPostModalOpen(false)}
              >
                Cancel
              </button>
              <Button
                type="button"
                disabled={!postingBankAccountId}
                onClick={() => void confirmPostBatch()}
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
