export async function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const state = globalThis as typeof globalThis & { __volunteerNotificationWorkerStarted?: boolean };
  if (state.__volunteerNotificationWorkerStarted) return;
  state.__volunteerNotificationWorkerStarted = true;
  let running = false;

  const configuredInterval = Number(process.env.VOLUNTEER_NOTIFICATION_WORKER_INTERVAL_MINUTES ?? "1");
  const intervalMinutes = [1, 10, 30, 60].includes(configuredInterval) ? configuredInterval : 1;
  const processNotifications = async () => {
    if (running) return;
    running = true;
    try {
      const { processDueVolunteerNotifications } = await import("./lib/event-volunteer-notifications");
      await processDueVolunteerNotifications();
    } catch (error) {
      console.error("Volunteer notification worker failed.", error);
    } finally {
      running = false;
    }
  };

  setTimeout(() => void processNotifications(), 15_000);
  setInterval(() => void processNotifications(), intervalMinutes * 60_000);
}
