type ChartItem = { label: string; count: number };
type ChartType = "bar" | "line" | "pie";
type ChartFormat = "number" | "currency";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function reportChartSvg(title: string, items: ChartItem[], chartType: ChartType = "bar", size: { width?: number; height?: number } = {}, format: ChartFormat = "number") {
  if (!items.length) return "";
  const width = size.width ?? 720;
  const height = size.height ?? 260;
  const left = 46;
  const right = 18;
  const top = 28;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(...items.map((item) => item.count), 1);
  const displayValue = (value: number) => format === "currency"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    : value.toLocaleString();
  const colors = ["#385f71", "#d97757", "#7b8f72", "#a66a3f", "#64748b", "#b45309"];
  const label = (value: string) => escapeXml(value.length > (width > 800 ? 34 : 22) ? `${value.slice(0, width > 800 ? 33 : 21)}…` : value);
  const x = (index: number) => left + ((index + 0.5) * plotWidth) / items.length;
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const grid = [0, 0.5, 1].map((fraction) => {
    const value = Math.round(max * fraction);
    const lineY = y(value);
    return `<line x1="${left}" y1="${lineY}" x2="${width - right}" y2="${lineY}" stroke="#e6e1d8" stroke-dasharray="3 3"/><text x="${left - 8}" y="${lineY + 5}" text-anchor="end" font-size="${width > 800 ? 14 : 10}" fill="#6f746f">${escapeXml(displayValue(value))}</text>`;
  }).join("");
  const labels = items.map((item, index) => `<text x="${x(index)}" y="${height - 20}" text-anchor="middle" font-size="${width > 800 ? 14 : 10}" fill="#6f746f">${label(item.label)}</text>`).join("");

  let marks = "";
  if (chartType === "line") {
    const points = items.map((item, index) => `${x(index)},${y(item.count)}`).join(" ");
    marks = `<polyline points="${points}" fill="none" stroke="#385f71" stroke-width="3"/>${items.map((item, index) => `<circle cx="${x(index)}" cy="${y(item.count)}" r="4" fill="#385f71"><title>${label(item.label)}: ${item.count}</title></circle>`).join("")}`;
  } else if (chartType === "pie") {
    const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
    const cx = width / 2;
    const cy = top + plotHeight / 2;
    const radius = Math.min(plotHeight, plotWidth) * 0.34;
    let angle = -Math.PI / 2;
    marks = items.map((item, index) => {
      const nextAngle = angle + (item.count / total) * Math.PI * 2;
      const largeArc = nextAngle - angle > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)} A ${radius} ${radius} 0 ${largeArc} 1 ${cx + radius * Math.cos(nextAngle)} ${cy + radius * Math.sin(nextAngle)} Z`;
      angle = nextAngle;
      return `<path d="${path}" fill="${colors[index % colors.length]}" stroke="#ffffff" stroke-width="2"><title>${label(item.label)}: ${item.count}</title></path>`;
    }).join("");
  } else {
    const barWidth = Math.max(8, plotWidth / items.length * 0.65);
    marks = items.map((item, index) => {
      const barHeight = plotHeight - (y(item.count) - top);
      return `<rect x="${x(index) - barWidth / 2}" y="${y(item.count)}" width="${barWidth}" height="${barHeight}" rx="4" fill="#d97757"><title>${label(item.label)}: ${displayValue(item.count)}</title></rect>`;
    }).join("");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/><text x="${left}" y="${width > 800 ? 26 : 17}" font-family="Arial, sans-serif" font-size="${width > 800 ? 20 : 13}" font-weight="bold" fill="#202a2e">${escapeXml(title)}</text>${chartType === "pie" ? "" : grid}${marks}${chartType === "pie" ? items.map((item, index) => `<text x="${width - 220}" y="${top + index * (width > 800 ? 22 : 16) + 8}" font-family="Arial, sans-serif" font-size="${width > 800 ? 14 : 10}" fill="#6f746f"><tspan fill="${colors[index % colors.length]}">●</tspan> ${label(item.label)} (${escapeXml(displayValue(item.count))})</text>`).join("") : labels}</svg>`;
}
