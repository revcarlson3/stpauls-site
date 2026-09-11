"use client";

type ReportSummaryChartItem = {
  label: string;
  count: number;
};

export function ReportSummaryChart({
  title,
  items,
  noun = "records",
  description,
  mode = "distribution"
}: {
  title: string;
  items: ReportSummaryChartItem[];
  noun?: string;
  description?: string;
  mode?: "distribution" | "trend";
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (!items.length) return null;

  return <section className="rounded-xl border border-ink/10 bg-mist/20 p-4" aria-label={title}>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-ink/55">{description ?? `Distribution across ${total.toLocaleString()} matching ${noun}.`}</p>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">{mode === "trend" ? "Trend" : "Chart"}</span>
    </div>
    <div className="mt-4 grid gap-3">
      {items.map((item) => {
        const percentage = total ? Math.round((item.count / total) * 100) : 0;
        const width = mode === "trend" ? Math.round((item.count / max) * 100) : percentage;
        return <div key={item.label} className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{item.label}</span>
            <span className="shrink-0 tabular-nums text-ink/60">{item.count.toLocaleString()} {mode === "distribution" ? <span className="text-xs">({percentage}%)</span> : null}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`${item.label}: ${item.count} ${noun}`}>
            <div className="h-full rounded-full bg-coral transition-[width]" style={{ width: `${Math.max(width, item.count ? 2 : 0)}%` }} />
          </div>
        </div>;
      })}
    </div>
  </section>;
}
