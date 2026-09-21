import { Container } from "@/components/ui";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { NotificationTemplates } from "./notification-templates";

export default async function NotificationTemplatesPage() {
  await authorizeVolunteerScheduling();
  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p>
      <h1 className="mt-2 font-serif text-4xl">Notification Templates</h1>
      <p className="mt-3 max-w-3xl text-ink/60">Customize the email and SMS messages sent to volunteers when they are scheduled to serve.</p>
      <NotificationTemplates />
    </Container>
  </main>;
}
