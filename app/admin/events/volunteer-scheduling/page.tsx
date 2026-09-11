import { Container } from "@/components/ui";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { VolunteerSchedulingManager } from "@/app/admin/membership/volunteers/volunteer-scheduling-manager";

export default async function VolunteerSchedulingPage() {
  await authorizeVolunteerScheduling();
  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p>
      <h1 className="mt-2 font-serif text-4xl">Volunteer Scheduling</h1>
      <p className="mt-3 max-w-3xl text-ink/60">Create events, select the volunteer teams needed, assign members, and record participation.</p>
      <VolunteerSchedulingManager />
    </Container>
  </main>;
}
