import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { Register, RegisterFilters } from "@/app/admin/accounting/register";
import { AccountActions } from "@/app/admin/accounting/bank-accounts";
import { ChartOfAccounts } from "@/app/admin/accounting/chart-of-accounts";
import { Budget } from "@/app/admin/accounting/budget";
import { Funds } from "@/app/admin/accounting/funds";
import { Contacts } from "@/app/admin/accounting/contacts";
import Link from "next/link";

const labels: Record<string, string> = {
  budget: "Budget",
  "chart-of-accounts": "Chart of Accounts",
  funds: "Funds",
  register: "Register",
  contacts: "Contacts",
  reports: "Reports",
  settings: "Settings"
};

export default async function AccountingSectionPage({ params }: { params: { section: string } }) {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const title = labels[params.section] ?? "Accounting";
  return <main><Container className="py-10 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Accounting and budget</p><h1 className="mt-2 font-serif text-4xl">{title}</h1>{params.section === "register" ? <p className="mt-3 max-w-2xl text-ink/60">Record and reconcile accounting transactions with balanced journal entries.</p> : params.section === "chart-of-accounts" ? <p className="mt-3 max-w-2xl text-ink/60">A five-digit nonprofit hierarchy shared by every church, with room for church-defined 8xxxx and 9xxxx accounts.</p> : params.section === "budget" ? <p className="mt-3 max-w-2xl text-ink/60">Plan income and expenses across the enabled standard accounting trees.</p> : params.section === "funds" ? <p className="mt-3 max-w-2xl text-ink/60">Manage active and inactive funds used to classify accounting activity.</p> : params.section === "contacts" ? <p className="mt-3 max-w-2xl text-ink/60">Manage people and businesses used as Register payees.</p> : params.section === "reports" ? <p className="mt-3 max-w-2xl text-ink/60">Run, customize, chart, and export accounting reports.</p> : <p className="mt-3 max-w-2xl text-ink/60">This foundation page is ready for the next accounting workflow.</p>}</div>{params.section === "register" && <div className="flex shrink-0 flex-wrap gap-2"><RegisterFilters /><AccountActions /></div>}{params.section === "reports" && <Link href="/admin/accounting" className="text-sm font-semibold text-coral hover:underline">Dashboard →</Link>}</div>{params.section === "register" && <Register />}{params.section === "chart-of-accounts" && <ChartOfAccounts />}{params.section === "budget" && <Budget />}{params.section === "funds" && <Funds />}{params.section === "contacts" && <Contacts />}</Container></main>;
}
