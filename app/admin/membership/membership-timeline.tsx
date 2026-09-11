"use client";

import { useEffect, useState } from "react";

type TimelineItem = {
  id: string;
  type: "audit" | "document" | "note" | "record" | "volunteer";
  title: string;
  description?: string | null;
  occurredAt: string;
  actor?: string | null;
  individualName?: string;
  document?: { downloadUrl: string; name: string };
};

const labels: Record<TimelineItem["type"], string> = {
  audit: "Change",
  document: "Document",
  note: "Note",
  record: "Record",
  volunteer: "Volunteer"
};

export function MembershipTimeline({ individualId, familyId }: { individualId?: string; familyId?: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(individualId ? { individualId } : { familyId: familyId ?? "" });
    setLoading(true);
    setError("");
    setShowAll(false);
    void fetch(`/api/membership/timeline?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load timeline.");
        setItems(body.timeline);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [familyId, individualId]);

  const visibleItems = showAll ? items : items.slice(0, 12);

  return (
    <section className="border-t border-ink/10 pt-5" aria-labelledby={`membership-timeline-${individualId ?? familyId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-coral">Change history</p>
          <h2 id={`membership-timeline-${individualId ?? familyId}`} className="mt-1 font-serif text-2xl">Timeline</h2>
        </div>
        <p className="text-xs text-ink/55">Newest first</p>
      </div>
      {loading ? <p className="mt-4 text-sm text-ink/60">Loading timeline...</p> : error ? (
        <p className="mt-4 text-sm text-coral" role="alert">{error}</p>
      ) : visibleItems.length ? (
        <>
          <ol className="mt-4 grid gap-0 border-l border-ink/15 pl-5">
            {visibleItems.map((item) => (
              <li key={item.id} className="relative pb-5 last:pb-0">
                <span className="absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full bg-coral" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-mist px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink/65">{labels[item.type]}</span>
                  {item.individualName && <span className="text-xs font-semibold text-coral">{item.individualName}</span>}
                </div>
                <p className="mt-1 text-sm font-semibold">{item.title}</p>
                {item.description && <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{item.description}</p>}
                {item.document && <a href={item.document.downloadUrl} className="mt-2 inline-block text-xs font-semibold text-coral underline-offset-2 hover:underline">Download {item.document.name}</a>}
                <p className="mt-1 text-xs text-ink/50">
                  <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
                  {item.actor ? ` · ${item.actor}` : ""}
                </p>
              </li>
            ))}
          </ol>
          {items.length > 12 && <button type="button" onClick={() => setShowAll((current) => !current)} className="focus-ring mt-4 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70">
            {showAll ? "Show recent activity" : `Show all ${items.length} entries`}
          </button>}
        </>
      ) : <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No timeline activity is available.</p>}
    </section>
  );
}
