import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { Container, Card } from "@/components/ui";
import { PrayerRequestReview } from "./review";
import { PrayerNotificationSettings } from "./notification-settings";
import { getPrayerRequestSettings } from "@/lib/app-config";
import { sendMembershipEmail } from "@/lib/membership-delivery";

function addresses(value: string) {
  return value.split(/[;,]/).map((item) => item.trim()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

export default async function PrayerRequestAdminPage() {
  await requirePermission("MANAGE_MEMBERSHIP");
  const expired = await db.prayerRequest.findMany({ where: { status: "APPROVED", expiresAt: { lte: new Date() }, expirationNotifiedAt: null }, select: { id: true, submitterName: true, request: true, includeInSundayPrayers: true, requestPastoralContact: true } });
  if (expired.length) {
    const settings = await getPrayerRequestSettings();
    let adminRecipients = addresses(settings.adminEmail);
    if (!adminRecipients.length) {
      const admins = await db.user.findMany({ where: { isActive: true, role: { in: ["admin", "editor"] } }, select: { email: true } });
      adminRecipients = admins.map((admin) => admin.email).filter(Boolean);
    }
    await Promise.all(expired.map(async (item) => {
      const recipients = Array.from(new Set([...adminRecipients, ...(item.includeInSundayPrayers ? addresses(settings.sundayEmail) : []), ...(item.requestPastoralContact ? addresses(settings.eldersEmail) : [])]));
      if (!recipients.length) return;
      const deliveries = await Promise.allSettled(recipients.map((recipient) => sendMembershipEmail({ recipient, subject: "Prayer request expired", bodyText: `${item.submitterName}'s prayer request has expired and is no longer shown in the member prayer list.\n\n${item.request}`, bodyHtml: `<p><strong>${item.submitterName}</strong>'s prayer request has expired and is no longer shown in the member prayer list.</p><p>${item.request.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`, attachments: [] })));
      if (deliveries.every((delivery) => delivery.status === "fulfilled")) {
        await db.prayerRequest.update({ where: { id: item.id }, data: { expirationNotifiedAt: new Date() } });
      }
    }));
  }
  const requests = await db.prayerRequest.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, submitterName: true, request: true, expiresAt: true, includeInSundayPrayers: true, requestPastoralContact: true, status: true, createdAt: true } });
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><h1 className="mt-2 font-serif text-4xl">Prayer request approvals</h1><p className="mt-3 text-ink/60">Approve requests before they appear on the member page.</p><div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"><Card><PrayerRequestReview requests={requests.map((item) => ({ ...item, expiresAt: item.expiresAt.toISOString(), createdAt: item.createdAt.toISOString() }))} /></Card><Card><h2 className="font-serif text-2xl">Notification addresses</h2><p className="mt-2 text-sm text-ink/60">Choose where approved requests are sent when members select either notification option.</p><div className="mt-5"><PrayerNotificationSettings /></div></Card></div></Container></main>;
}
