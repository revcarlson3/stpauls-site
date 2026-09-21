"use client";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { Button } from "@/components/ui";

pdfMake.vfs = pdfFonts.vfs;
const pdf = pdfMake as typeof pdfMake & { createPdf: (definition: object) => { download: (filename: string) => void } };

type Row = { id: string; code?: string | number; account?: string | number; budget?: string | number; actual?: string | number; variance?: string | number; isGroup?: boolean; isSubtotal?: boolean; isTotal?: boolean };
type Statement = { income: { label: string; amount: number }[]; expenses: { label: string; amount: number }[]; accounts: { label: string; amount: number }[]; totalIncome: number; totalExpenses: number; net: number; accountsTotal: number };
type Report = { name: string; dateFrom?: string; dateTo?: string; generatedAt: string; generatedBy: string; statement?: Statement };

const money = (value: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
const dateLabel = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";
const signedMoney = (value: number) => value < 0 ? `(${money(Math.abs(value))})` : money(value);

export function TreasurerReport({ report, rows }: { report: Report; rows: Row[] }) {
  const detailRows = rows.filter((row) => !row.isGroup && !row.isSubtotal && !row.isTotal);
  const statement = report.statement;
  const period = `${dateLabel(report.dateFrom)} – ${dateLabel(report.dateTo)}`;
  const columns = ["Account", "Description", "Quarterly Expenses", "Budget to Date", "Expenses to Date", "Over/Under"];
  const tableRows = rows.map((row) => {
    const style = row.isGroup ? { fillColor: "#f2eee7", bold: true } : row.isSubtotal ? { fillColor: "#faf8f4", bold: true } : row.isTotal ? { fillColor: "#e8e1d7", bold: true } : {};
    const cell = (text: string, alignment: "left" | "right" = "left") => ({ text, alignment, ...style });
    return [
      cell(String(row.code ?? "")),
      cell(String(row.account ?? "")),
      cell(row.isGroup ? "" : money(row.actual), "right"),
      cell(row.isGroup ? "" : money(row.budget), "right"),
      cell(row.isGroup ? "" : money(row.actual), "right"),
      cell(row.isGroup ? "" : signedMoney(Number(row.variance) || 0), "right")
    ];
  });
  const csv = (() => {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
    return [columns, ...rows.map((row) => [row.code ?? "", row.account ?? "", row.isGroup ? "" : row.actual ?? "", row.isGroup ? "" : row.budget ?? "", row.isGroup ? "" : row.actual ?? "", row.isGroup ? "" : row.variance ?? ""])].map((line) => line.map(escape).join(",")).join("\r\n");
  })();
  function downloadCsv() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  function downloadPdf() {
    const statementRows = statement?.accounts.map((account) => [{ text: account.label }, { text: money(account.amount), alignment: "right" }]) ?? [];
    pdf.createPdf({
      pageSize: "LETTER",
      pageOrientation: "landscape",
      pageMargins: [28, 28, 28, 28],
      content: [
        { text: "St. Paul's Lutheran Church", style: "church" },
        { text: report.name, style: "title" },
        { text: `Report period: ${period}`, style: "meta" },
        { text: "Account detail", style: "section" },
        { table: { headerRows: 1, widths: [55, "*", 85, 85, 85, 85], body: [columns.map((column) => ({ text: column, bold: true, fillColor: "#e8e1d7" })), ...tableRows] }, layout: "lightHorizontalLines" },
        { text: "Giving, other income, expenses, and accounts", pageBreak: "before", style: "section" },
        { text: "Giving and other income", style: "subsection" },
        { text: "Includes giving-related income plus interest, third-party deposits, and other income recorded by the treasurer.", style: "note" },
        { table: { widths: ["*", 100], body: [[{ text: "Source", bold: true }, { text: "Amount", bold: true, alignment: "right" }], ...(statement?.income ?? []).map((item) => [{ text: item.label }, { text: money(item.amount), alignment: "right" }]), [{ text: "TOTAL INCOME", bold: true }, { text: money(statement?.totalIncome), bold: true, alignment: "right" }]] }, layout: "lightHorizontalLines" },
        { text: "Expenses", style: "subsection" },
        { table: { widths: ["*", 100], body: [[{ text: "Category", bold: true }, { text: "Amount", bold: true, alignment: "right" }], ...(statement?.expenses ?? []).map((item) => [{ text: item.label }, { text: money(item.amount), alignment: "right" }]), [{ text: "TOTAL EXPENSES", bold: true }, { text: money(statement?.totalExpenses), bold: true, alignment: "right" }]] }, layout: "lightHorizontalLines" },
        { text: `NET TOTAL  ${signedMoney(statement?.net ?? 0)}`, style: "total" },
        { text: "Accounts", style: "subsection" },
        { table: { widths: ["*", 100], body: [[{ text: "Account", bold: true }, { text: "Balance", bold: true, alignment: "right" }], ...statementRows, [{ text: "ACCOUNTS TOTAL", bold: true }, { text: money(statement?.accountsTotal), bold: true, alignment: "right" }]] }, layout: "lightHorizontalLines" }
      ],
      styles: { church: { alignment: "center", bold: true, fontSize: 14 }, title: { alignment: "center", bold: true, fontSize: 18, margin: [0, 4, 0, 4] }, meta: { alignment: "center", color: "#555555", margin: [0, 0, 0, 14] }, section: { bold: true, fontSize: 13, margin: [0, 8, 0, 6] }, subsection: { bold: true, fontSize: 11, margin: [0, 10, 0, 4] }, note: { color: "#555555", fontSize: 8, margin: [0, -2, 0, 4] }, total: { bold: true, fontSize: 12, margin: [0, 12, 0, 4] } }
    }).download(`${report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  }
  return <div className="mt-5">
    <div className="flex flex-wrap justify-end gap-2 print:hidden"><Button type="button" variant="secondary" onClick={downloadCsv}>Export CSV</Button><Button type="button" onClick={downloadPdf}>Export PDF</Button></div>
    <article className="treasurer-statement mt-4 bg-white p-5 text-sm shadow-sm sm:p-8">
      <header className="text-center"><h3 className="font-serif text-xl font-semibold">St. Paul&apos;s Lutheran Church</h3><h2 className="mt-1 font-serif text-2xl font-bold">{report.name}</h2><p className="mt-1 text-xs text-ink/60">Report period: {period}</p></header>
      <table className="mt-6 w-full border-collapse text-xs"><thead><tr className="border-b-2 border-ink/40 text-left">{columns.map((column) => <th key={column} className="px-2 py-2 first:w-16 last:text-right">{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={row.isGroup ? "treasurer-category" : row.isSubtotal ? "treasurer-subtotal" : row.isTotal ? "treasurer-total" : "border-b border-ink/10"}><td className="px-2 py-1">{row.code}</td><td className="px-2 py-1">{row.account}</td><td className="px-2 py-1 text-right">{row.isGroup ? "" : money(row.actual)}</td><td className="px-2 py-1 text-right">{row.isGroup ? "" : money(row.budget)}</td><td className="px-2 py-1 text-right">{row.isGroup ? "" : money(row.actual)}</td><td className="px-2 py-1 text-right">{row.isGroup ? "" : signedMoney(Number(row.variance) || 0)}</td></tr>)}</tbody></table>
      <section className="treasurer-second-page mt-10 grid gap-6 border-t-2 border-ink/30 pt-6 sm:grid-cols-2">
        <div><h3 className="font-semibold">Giving and other income</h3><p className="mb-2 text-xs text-ink/55">Includes giving, interest, third-party deposits, and other income recorded by the treasurer.</p>{statement?.income.map((item) => <SummaryLine key={item.label} label={item.label} amount={item.amount} />)}<SummaryLine label="TOTAL INCOME" amount={statement?.totalIncome ?? 0} strong /></div>
        <div><h3 className="font-semibold">Expenses</h3>{statement?.expenses.map((item) => <SummaryLine key={item.label} label={item.label} amount={item.amount} />)}<SummaryLine label="TOTAL EXPENSES" amount={statement?.totalExpenses ?? 0} strong /></div>
        <div><SummaryLine label="NET TOTAL" amount={statement?.net ?? 0} strong /></div>
        <div><h3 className="font-semibold">Accounts</h3>{statement?.accounts.map((item) => <SummaryLine key={item.label} label={item.label} amount={item.amount} />)}<SummaryLine label="ACCOUNTS TOTAL" amount={statement?.accountsTotal ?? 0} strong /></div>
      </section>
      <p className="mt-6 text-right text-[10px] text-ink/50">Generated {new Date(report.generatedAt).toLocaleString()}{report.generatedBy ? ` by ${report.generatedBy}` : ""}</p>
    </article>
  </div>;
}

function SummaryLine({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 border-b border-ink/10 py-1 ${strong ? "font-bold" : ""}`}><span>{label}</span><span className="tabular-nums">{signedMoney(amount)}</span></div>;
}
