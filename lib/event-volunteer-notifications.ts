import { db } from "@/lib/db";
import { sendMembershipEmail, sendSmsText } from "@/lib/membership-delivery";
import { resolveMembershipMessageRecipient } from "@/lib/membership-privacy";
import { htmlToText, sanitizeEmailHtml } from "@/lib/membership-messaging";
import { isWithinQuietHours } from "@/lib/event-notification-schedule";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function mergeTags(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (_, tag: string) => values[tag] ?? "");
}

export async function processDueVolunteerNotifications(churchId?: string) {
  const due = await db.membershipVolunteerNotification.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: new Date() },
      ...(churchId ? { assignment: { event: { churchId } } } : {})
    },
    take: 100,
    orderBy: { scheduledFor: "asc" },
    include: {
      assignment: {
        include: {
          event: { select: { churchId: true, title: true, startsAt: true, location: true, readingsUrl: true } },
          group: { select: { id: true, name: true, singularName: true } },
          individual: {
            select: {
              id: true, firstName: true, lastName: true, email: true, cellphone: true, emailMessagesAllowed: true, smsMessagesAllowed: true, doNotContact: true, status: true,
              family: {
                select: {
                  email: true, phone: true, phoneIsMobile: true,
                  individuals: {
                    where: { status: { not: "REMOVED" } },
                    select: { id: true, status: true, email: true, cellphone: true, emailMessagesAllowed: true, smsMessagesAllowed: true, doNotContact: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  const churchIds = Array.from(new Set(due.map((notification) => notification.assignment.event.churchId)));
  const [templates, churchSettings] = await Promise.all([
    db.membershipEventNotificationTemplate.findMany({ where: { churchId: { in: churchIds } } }),
    db.membershipEventSettings.findMany({ where: { churchId: { in: churchIds } }, select: { churchId: true, timeZone: true, notificationQuietHoursEnabled: true, notificationQuietHoursStart: true, notificationQuietHoursEnd: true } })
  ]);
  const settingsByChurch = new Map(churchSettings.map((settings) => [settings.churchId, settings]));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const notification of due) {
    const member = notification.assignment.individual;
    const channel = notification.channel as "EMAIL" | "SMS";
    const eligibility = resolveMembershipMessageRecipient(member, channel);
    if (!eligibility.eligible || !eligibility.address) {
      await db.membershipVolunteerNotification.update({ where: { id: notification.id }, data: { status: "SKIPPED", failureReason: eligibility.reason ?? "Not eligible for this channel." } });
      skipped++;
      continue;
    }
    const event = notification.assignment.event;
    const settings = settingsByChurch.get(event.churchId);
    if (settings?.notificationQuietHoursEnabled && isWithinQuietHours(new Date(), settings.timeZone, settings.notificationQuietHoursStart, settings.notificationQuietHoursEnd)) continue;
    const churchTemplates = templates.filter((template) => template.churchId === event.churchId);
    const template = churchTemplates.find((candidate) => candidate.groupId === notification.assignment.group.id)
      ?? churchTemplates.find((candidate) => candidate.groupId === null);
    if (!template) {
      await db.membershipVolunteerNotification.update({ where: { id: notification.id }, data: { status: "FAILED", failureReason: "No volunteer notification template is configured." } });
      failed++;
      continue;
    }
    const eventDate = event.startsAt.toLocaleDateString("en-US", { dateStyle: "full" });
    const eventTime = event.startsAt.toLocaleTimeString("en-US", { timeStyle: "short" });
    const values = {
      volunteerName: `${member.firstName}${member.lastName ? ` ${member.lastName}` : ""}`,
      volunteerFirstName: member.firstName,
      volunteerGroupName: notification.assignment.group.name,
      volunteerGroupSingularName: notification.assignment.group.singularName || notification.assignment.group.name,
      eventName: event.title,
      eventDate,
      eventTime,
      eventLocation: event.location ?? "",
      eventReadingsUrl: event.readingsUrl ?? "",
      churchName: ""
    };
    const dayBefore = notification.kind === "DAY_BEFORE";
    const subject = mergeTags(dayBefore ? template.emailDayBeforeSubject : template.emailSubject, values);
    const emailHtml = sanitizeEmailHtml(mergeTags(dayBefore ? template.emailDayBeforeBodyHtml : template.emailBodyHtml, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeHtml(value)]))));
    const body = mergeTags(dayBefore ? template.smsDayBeforeBody : template.smsBody, values);
    try {
      if (channel === "EMAIL") await sendMembershipEmail({ recipient: eligibility.address, subject, bodyText: htmlToText(emailHtml), bodyHtml: emailHtml, attachments: [] });
      else await sendSmsText(eligibility.address, body);
      await db.membershipVolunteerNotification.update({ where: { id: notification.id }, data: { status: "SENT", sentAt: new Date(), failureReason: null } });
      sent++;
    } catch (reason) {
      await db.membershipVolunteerNotification.update({ where: { id: notification.id }, data: { status: "FAILED", failureReason: (reason instanceof Error ? reason.message : "Delivery failed.").slice(0, 1000) } });
      failed++;
    }
  }
  return { processed: due.length, sent, skipped, failed };
}
