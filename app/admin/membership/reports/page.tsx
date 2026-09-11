import dynamic from "next/dynamic";
import { Container } from "@/components/ui";
import { ReportManager } from "./report-manager";

const ReportResults = dynamic(() => import("./report-results").then((module) => module.ReportResults), { ssr: false });

export default function MembershipReportsPage() {
  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 font-serif text-4xl">Reports</h1>
          <p className="mt-3 max-w-2xl text-ink/60">Review membership trends, participation, audiences, and communication results.</p>
        </div>
        <a href="/admin/membership" className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Back to directory</a>
      </div>
      <ReportManager />
      <div className="mt-8"><ReportResults /></div>
    </Container>
  </main>;
}
