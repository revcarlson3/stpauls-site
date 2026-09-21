import dynamic from "next/dynamic";
import { Container } from "@/components/ui";
import { AccountingReports } from "./reports";

const AccountingReportResults = dynamic(() => import("./results").then((module) => module.AccountingReportResults), { ssr: false });

export default function AccountingReportsPage() {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Accounting and budget</p><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="mt-2 font-serif text-4xl">Reports</h1><p className="mt-3 max-w-2xl text-ink/60">Run standard accounting reports or build a reusable custom report with filters, grouping, charts, and exports.</p></div></div><AccountingReports /><AccountingReportResults /></Container></main>;
}
