"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ReportSummaryChartItem = {
  label: string;
  count: number;
};

const colors = ["#385f71", "#d97757", "#7b8f72", "#a66a3f", "#64748b", "#b45309"];

export function ReportSummaryChart({
  title,
  items,
  noun = "records",
  description,
  mode = "distribution",
  chartType = "bar",
  valueFormat = "number",
}: {
  title: string;
  items: ReportSummaryChartItem[];
  noun?: string;
  description?: string;
  mode?: "distribution" | "trend";
  chartType?: "bar" | "line" | "pie";
  valueFormat?: "number" | "currency";
}) {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const data = items.map((item) => ({ name: item.label, value: item.count }));
  const formatValue = (value: number) => valueFormat === "currency" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value) : value.toLocaleString();

  return <section className="rounded-xl border border-ink/10 bg-mist/20 p-4" aria-label={title}>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-ink/55">{description ?? `Distribution across ${total.toLocaleString()} matching ${noun}.`}</p>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">{chartType === "pie" ? "Pie chart" : chartType === "line" ? "Line chart" : mode === "trend" ? "Trend" : "Bar chart"}</span>
    </div>
    <div className="mt-4 h-64 w-full" role="img" aria-label={`${title} showing ${total.toLocaleString()} ${noun}`}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={48} outerRadius={82} paddingAngle={2}>
              {data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatValue(Number(value))} />
            <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : chartType === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#e6e1d8" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={valueFormat === "currency"} tickFormatter={formatValue} tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} width={valueFormat === "currency" ? 64 : 36} />
            <Tooltip formatter={(value) => formatValue(Number(value))} />
            <Line type="monotone" dataKey="value" name="Count" stroke="#385f71" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#e6e1d8" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={valueFormat === "currency"} tickFormatter={formatValue} tick={{ fill: "#6f746f", fontSize: 11 }} axisLine={false} tickLine={false} width={valueFormat === "currency" ? 64 : 36} />
            <Tooltip formatter={(value) => formatValue(Number(value))} />
            <Bar dataKey="value" name="Count" fill="#d97757" radius={[5, 5, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  </section>;
}
