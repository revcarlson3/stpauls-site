import { Container } from "@/components/ui";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { AttendanceManager } from "@/app/admin/membership/attendance/attendance-manager";

export default async function AttendancePage() {
  await authorizeVolunteerScheduling();
  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p>
      <h1 className="mt-2 font-serif text-4xl">Attendance</h1>
      <p className="mt-3 max-w-3xl text-ink/60">Select a calendar event, check in assigned members, and record visitors.</p>
      <AttendanceManager />
    </Container>
  </main>;
}
