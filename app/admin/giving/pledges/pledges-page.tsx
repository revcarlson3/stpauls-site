"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container } from "@/components/ui";

type Campaign = {
  id: string;
  name: string;
  createdAt: string;
};
type Category = { id: string; code: string; name: string };
type Assignment = { memberId: string; memberName: string; amount: string };
type Member = { id: string; name: string; envelopeNumber: string | null };
type PledgeSummary = {
  memberId: string;
  envelopeNumber: string | null;
  memberName: string;
  pledged: string;
  given: string;
};

function formatCurrency(value: string) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

const emptyAssignment = (): Assignment => ({
  memberId: "",
  memberName: "",
  amount: "",
});

export function PledgesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([
    emptyAssignment(),
    emptyAssignment(),
    emptyAssignment(),
  ]);
  const [memberSearch, setMemberSearch] = useState<Record<number, string>>({});
  const [memberOptions, setMemberOptions] = useState<Record<number, Member[]>>({});
  const [detailName, setDetailName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pledgeSummary, setPledgeSummary] = useState<PledgeSummary[]>([]);
  const [detailRefresh, setDetailRefresh] = useState(0);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const response = await fetch("/api/giving/pledges", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load pledge campaigns.");
      const nextCampaigns = value.campaigns ?? [];
      setCampaigns(nextCampaigns);
      setSelectedId((current) =>
        nextCampaigns.some((campaign: Campaign) => campaign.id === current)
          ? current
          : nextCampaigns[0]?.id ?? null,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load pledge campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    void fetch(`/api/giving/pledges?campaignId=${encodeURIComponent(selectedId)}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((value) => {
        if (!value.campaign) throw new Error(value.error ?? "Unable to load pledge campaign.");
        const campaign = value.campaign;
        setCategories(value.categories ?? []);
        setPledgeSummary(value.pledgeSummary ?? []);
        setDetailName(campaign.name);
        setCategoryId(campaign.categoryId ?? "");
        setStartDate(campaign.startDate ? campaign.startDate.slice(0, 10) : "");
        setEndDate(campaign.endDate ? campaign.endDate.slice(0, 10) : "");
        const savedAssignments = (campaign.assignments ?? []).map(
          (assignment: { memberId: string; amount: string; member: { id: string; firstName: string; lastName: string | null; envelopeNumber: string | null } }) => ({
            memberId: assignment.memberId,
            memberName: [assignment.member.firstName, assignment.member.lastName]
              .filter(Boolean)
              .join(" "),
            amount: String(assignment.amount),
          }),
        );
        setAssignments([
          ...savedAssignments,
          ...Array.from(
            { length: Math.max(0, 3 - savedAssignments.length) },
            emptyAssignment,
          ),
        ]);
        setMemberSearch({});
        setMemberOptions({});
      })
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Unable to load pledge campaign."),
      )
      .finally(() => setDetailLoading(false));
  }, [selectedId, detailRefresh]);

  async function addCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/giving/pledges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: campaignName }),
    });
    const value = await response.json();
    if (!response.ok) {
      setMessage(value.error ?? "Unable to create pledge campaign.");
      return;
    }
    setCampaignName("");
    setAddModalOpen(false);
    await loadCampaigns();
    setSelectedId(value.campaign.id);
  }

  async function deleteCampaign() {
    if (!selectedCampaign) return;
    setMessage("");
    const response = await fetch(
      `/api/giving/pledges?id=${encodeURIComponent(selectedCampaign.id)}`,
      { method: "DELETE" },
    );
    const value = await response.json();
    if (!response.ok) {
      setMessage(value.error ?? "Unable to delete pledge campaign.");
      return;
    }
    setDeleteModalOpen(false);
    await loadCampaigns();
  }

  function updateAssignment(index: number, changes: Partial<Assignment>) {
      setAssignments((current) =>
        current.map((assignment, assignmentIndex) =>
          assignmentIndex === index ? { ...assignment, ...changes } : assignment,
        ),
      );
      if (
        index === assignments.length - 1 &&
        (changes.memberId || changes.memberName || changes.amount)
      ) {
        setAssignments((current) => [...current, emptyAssignment()]);
      }
    }

  async function searchMembers(index: number, search: string) {
      setMemberSearch((current) => ({ ...current, [index]: search }));
      updateAssignment(index, { memberId: "", memberName: "" });
      const validSearch = search.length >= 3 || /^\d+$/.test(search);
      if (!validSearch) {
        setMemberOptions((current) => ({ ...current, [index]: [] }));
        return;
      }
      const response = await fetch(
        `/api/giving/contributions?search=${encodeURIComponent(search)}`,
      );
      const value = await response.json();
      setMemberOptions((current) => ({ ...current, [index]: value.members ?? [] }));
    }

  async function saveDetails() {
      if (!selectedId) return;
      setSaving(true);
      setMessage("");
      const response = await fetch("/api/giving/pledges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedId,
          name: detailName,
          categoryId: categoryId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          assignments: assignments.map((assignment) => ({
            memberId: assignment.memberId,
            amount: assignment.amount,
          })),
        }),
      });
      const value = await response.json();
      setSaving(false);
      if (!response.ok) {
        setMessage(value.error ?? "Unable to save pledge campaign.");
        return;
      }
      await loadCampaigns();
      setDetailRefresh((current) => current + 1);
      setMessage("Pledge campaign saved.");
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
          Giving and pledges
        </p>
        <h1 className="mt-2 font-serif text-4xl">Pledges</h1>
        {message && (
          <p role="alert" className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">
            {message}
          </p>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <Card className="min-w-0 p-5 lg:col-span-3">
            <div className="inline-flex overflow-hidden rounded-full border border-ink/15">
              <button
                type="button"
                aria-label="Add pledge campaign"
                className="focus-ring inline-flex items-center gap-2 bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral/85"
                onClick={() => {
                  setCampaignName("");
                  setMessage("");
                  setAddModalOpen(true);
                }}
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                Add
              </button>
              <button
                type="button"
                aria-label="Delete selected pledge campaign"
                disabled={!selectedCampaign}
                className="focus-ring inline-flex items-center gap-2 border-l border-white/30 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40"
                onClick={() => setDeleteModalOpen(true)}
              >
                <span aria-hidden="true" className="text-base leading-none">🗑</span>
                Delete
              </button>
            </div>
            <h2 className="mt-6 font-serif text-2xl">Pledge campaigns</h2>
            {loading ? (
              <p className="mt-4 text-sm text-ink/55">Loading campaigns…</p>
            ) : campaigns.length ? (
              <div className="mt-4 grid gap-2">
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    className={`focus-ring rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${selectedId === campaign.id ? "bg-coral text-white" : "bg-mist/60 text-ink hover:bg-coral/10"}`}
                    onClick={() => setSelectedId(campaign.id)}
                  >
                    {campaign.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-ink/55">
                No pledge campaigns have been created.
              </p>
            )}
          </Card>
          <Card className="min-w-0 p-6 lg:col-span-9">
            {selectedCampaign && !detailLoading ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
                  Pledge campaign
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                    Campaign name
                    <input
                      value={detailName}
                      onChange={(event) => setDetailName(event.target.value)}
                      className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Pledge category
                    <select
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                    >
                      <option value="">Choose a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.code} · {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-sm font-semibold">
                      Start date
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      End date
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-8 overflow-x-auto">
                  <h3 className="font-serif text-2xl">Pledge assignments</h3>
                  <table className="mt-3 w-full min-w-[34rem] text-left text-sm">
                    <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/55">
                      <tr>
                        <th className="px-3 py-2">Member</th>
                        <th className="w-44 px-3 py-2">Pledge amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment, index) => (
                        <tr key={index} className="border-b border-ink/10 align-top">
                          <td className="relative z-50 px-3 py-3">
                            <input
                              value={memberSearch[index] ?? assignment.memberName}
                              onChange={(event) =>
                                void searchMembers(index, event.target.value)
                              }
                              placeholder="Last name or envelope #"
                              className="focus-ring w-full rounded-lg border border-ink/15 px-2 py-2"
                            />
                            {memberOptions[index]?.length > 0 && (
                              <div className="absolute left-3 top-14 z-[100] grid w-[calc(100%-1.5rem)] rounded-lg border border-ink/10 bg-white p-1 shadow-lg">
                                {memberOptions[index].map((member) => (
                                  <button
                                    key={member.id}
                                    type="button"
                                    className="focus-ring rounded px-2 py-2 text-left hover:bg-mist"
                                    onClick={() => {
                                      updateAssignment(index, {
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
                                    {member.envelopeNumber
                                      ? ` · #${member.envelopeNumber}`
                                      : ""}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={assignment.amount}
                              onChange={(event) =>
                                updateAssignment(index, { amount: event.target.value })
                              }
                              className="focus-ring w-full rounded-lg border border-ink/15 px-2 py-2"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <Button type="button" disabled={saving} onClick={() => void saveDetails()}>
                    {saving ? "Saving..." : "Save campaign"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid min-h-64 place-items-center text-center">
                <p className="max-w-md leading-7 text-ink/55">
                  Select a pledge campaign or use the plus button to create one.
                </p>
              </div>
            )}
          </Card>
        </div>
        {selectedCampaign && !detailLoading && (
          <Card className="mt-6 min-w-0 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
              Pledge progress
            </p>
            <h2 className="mt-2 font-serif text-2xl">{selectedCampaign.name}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/55">
                  <tr>
                    <th className="px-3 py-2">Envelope #</th>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2 text-right">Pledge amount</th>
                    <th className="px-3 py-2 text-right">Amount given</th>
                  </tr>
                </thead>
                <tbody>
                  {pledgeSummary.map((summary) => (
                    <tr key={summary.memberId} className="border-b border-ink/10">
                      <td className="px-3 py-2">{summary.envelopeNumber ?? "—"}</td>
                      <td className="px-3 py-2">{summary.memberName}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(summary.pledged)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(summary.given)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-3 py-3" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(
                        pledgeSummary
                          .reduce((total, summary) => total + Number(summary.pledged), 0)
                          .toFixed(2),
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(
                        pledgeSummary
                          .reduce((total, summary) => total + Number(summary.given), 0)
                          .toFixed(2),
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              {!pledgeSummary.length && (
                <p className="px-3 py-4 text-sm text-ink/55">
                  No members have been assigned to this pledge campaign.
                </p>
              )}
            </div>
          </Card>
        )}
      </Container>
      {addModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
          <form
            onSubmit={(event) => void addCampaign(event)}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-pledge-campaign-title"
          >
            <h2 id="add-pledge-campaign-title" className="font-serif text-2xl">
              Add pledge campaign
            </h2>
            <label className="mt-5 grid gap-1 text-sm font-semibold">
              Campaign name
              <input
                autoFocus
                required
                maxLength={200}
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"
                placeholder="2026 Building Campaign"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-mist"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </button>
              <Button type="submit">Add campaign</Button>
            </div>
          </form>
        </div>
      )}
      {deleteModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-pledge-campaign-title"
          >
            <h2 id="delete-pledge-campaign-title" className="font-serif text-2xl">
              Delete pledge campaign?
            </h2>
            <p className="mt-3 leading-7 text-ink/60">
              This will delete <strong>{selectedCampaign.name}</strong>.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-mist"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <Button type="button" onClick={() => void deleteCampaign()}>
                Delete campaign
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
