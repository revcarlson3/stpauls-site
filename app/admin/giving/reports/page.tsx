import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { Container } from "@/components/ui";
import { GivingReports } from "./giving-reports";
import { GivingReportResults } from "./giving-report-results";

export default async function GivingReportsPage() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  await requireCurrentChurch();
  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
          Giving and pledges
        </p>
        <h1 className="mt-2 font-serif text-4xl">Reports</h1>
        <p className="mt-3 max-w-2xl text-ink/60">
          Run giving-focused reports or build a reusable custom contribution report.
        </p>
        <GivingReports />
        <GivingReportResults />
      </Container>
    </main>
  );
}
