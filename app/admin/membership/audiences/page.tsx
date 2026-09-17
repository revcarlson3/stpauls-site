import { Container } from "@/components/ui";
import { AudienceManager } from "../settings/audience-manager";

export default function MembershipAudiencesPage() {
  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 font-serif text-4xl">Groups</h1>
          <p className="mt-3 max-w-2xl text-ink/60">Create and manage reusable volunteer and manual groups for membership communication.</p>
        </div>
        <a href="/admin/membership/settings" className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Member settings</a>
      </div>
      <AudienceManager />
    </Container>
  </main>;
}
