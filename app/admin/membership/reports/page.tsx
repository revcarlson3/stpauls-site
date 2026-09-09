import { Container } from "@/components/ui";

const plannedReports = [
  ["Membership overview", "Active, inactive, deceased, and removed member counts."],
  ["Age and grade distribution", "Breakdowns by age category and school grade."],
  ["Audience membership", "Volunteer groups, manual lists, dynamic lists, and member types."],
  ["Messaging delivery", "Message volume, delivery status, failures, and retries."]
];

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
      <section className="mt-8 max-w-4xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-2xl">Reporting workspace</h2>
        <p className="mt-2 text-sm text-ink/60">Report builders will be added here. The first reports will use the same live membership, audience, volunteer, and messaging data already used throughout Membership.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {plannedReports.map(([title, description]) => <div key={title} className="rounded-xl border border-ink/10 bg-mist/30 p-4"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-ink/60">{description}</p></div>)}
        </div>
      </section>
    </Container>
  </main>;
}
