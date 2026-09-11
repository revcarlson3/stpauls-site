import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  BUILT_IN_MESSAGE_TEMPLATES,
  EMAIL_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  htmlToText,
  interpolateMessage,
  sanitizeEmailHtml
} from "@/lib/membership-messaging";
import { sendMembershipEmail, sendSmsText } from "@/lib/membership-delivery";
import { dynamicMemberIds, resolveAudienceMemberIds, type AudienceType } from "@/lib/membership-audiences";
import { membershipMessageEligibility } from "@/lib/membership-privacy";

const recipientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  cellphone: true,
  emailMessagesAllowed: true,
  smsMessagesAllowed: true,
  preferredContactMethod: true,
  doNotContact: true,
  communicationNotes: true,
  status: true,
  family: { select: { lastName: true, addressCity: true } }
} as const;

function memberName(member: { firstName: string; lastName: string | null; family?: { lastName: string } }) {
  return `${member.firstName} ${member.lastName ?? member.family?.lastName ?? ""}`.trim();
}

function mergeContext(member: { firstName: string; lastName: string | null; family?: { lastName: string; addressCity: string | null } }, churchName: string) {
  const lastName = member.lastName ?? member.family?.lastName ?? "";
  const familyName = member.family?.lastName ?? lastName;
  return {
    firstName: member.firstName,
    lastName,
    familyName,
    formalGreeting: `Dear ${member.firstName} ${lastName}`.trim(),
    informalGreeting: `Hi ${member.firstName}`.trim(),
    city: member.family?.addressCity ?? "",
    churchName,
    currentYear: String(new Date().getFullYear())
  };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function statusForTarget(targetType: string): MembershipStatus | null {
  if (targetType === "active-members") return MembershipStatus.ACTIVE;
  if (targetType === "inactive-members") return MembershipStatus.INACTIVE;
  if (targetType === "deceased-members") return MembershipStatus.DECEASED;
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const url = new URL(request.url);
    const targetType = url.searchParams.get("targetType") || "selected-members";
    const audienceId = url.searchParams.get("audienceId")?.trim() || "";
    const targetStatus = statusForTarget(targetType);
    const statusFilter: MembershipStatus | { not: MembershipStatus } = targetStatus ?? { not: MembershipStatus.REMOVED };
    if (audienceId && targetType === "selected-members") return NextResponse.json({ error: "A selected-member audience cannot include an audience ID." }, { status: 400 });
    const selectedIds = url.searchParams.getAll("memberId").flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
    const limitSettings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { membershipMessageRecipientLimit: true } });
    const recipientLimit = limitSettings?.membershipMessageRecipientLimit ?? 200;
    const memberIds = targetStatus
      ? (await db.membershipIndividual.findMany({ where: { status: targetStatus }, select: { id: true } })).map((member) => member.id)
      : await resolveAudienceMemberIds(targetType as AudienceType, targetType === "selected-members" ? selectedIds : audienceId);
    const [members, customTemplates, messageSettings] = await Promise.all([
      db.membershipIndividual.findMany({ where: { id: { in: memberIds }, status: statusFilter }, select: recipientSelect }),
      db.membershipMessageTemplate.findMany({ orderBy: [{ updatedAt: "desc" }], take: 50, select: { id: true, name: true, subject: true, bodyHtml: true, bodyText: true } }),
      db.securitySettings.findUnique({ where: { id: 1 }, select: { siteName: true, membershipMessageRecipientLimit: true, emailProvider: true, emailApiKeyEncrypted: true, emailApiSecretEncrypted: true, smtpHost: true, smtpUser: true, smtpPasswordEncrypted: true, emailFrom: true, smsAccountId: true, smsAuthSecretEncrypted: true, smsFrom: true } })
    ]);
    if (members.length > recipientLimit) return NextResponse.json({ error: `Select ${recipientLimit.toLocaleString()} or fewer members.` }, { status: 400 });
    const [groups, lists, dynamicListRecords, types] = await Promise.all([
      db.membershipVolunteerGroup.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, description: true, _count: { select: { members: true } } } }),
      db.membershipManualList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, _count: { select: { members: true } } } }),
      db.membershipDynamicList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, criteria: true } }),
      db.membershipMemberType.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, _count: { select: { individuals: true } } } })
    ]);
    const dynamicLists = await Promise.all(dynamicListRecords.map(async (list) => ({ id: list.id, name: list.name, description: list.description, count: (await dynamicMemberIds(list.criteria)).length })));
    return NextResponse.json({
      recipients: members.map((member) => ({
        id: member.id,
        name: memberName(member),
        email: member.email,
        phone: member.cellphone,
        preferredContactMethod: member.preferredContactMethod,
        doNotContact: member.doNotContact,
        communicationNotes: member.communicationNotes,
        emailEligible: membershipMessageEligibility(member, "EMAIL").eligible,
        smsEligible: membershipMessageEligibility(member, "SMS").eligible,
        emailReason: membershipMessageEligibility(member, "EMAIL").reason,
        smsReason: membershipMessageEligibility(member, "SMS").reason
      })),
      templates: [...BUILT_IN_MESSAGE_TEMPLATES.map((template) => ({ ...template, builtIn: true })), ...customTemplates.map((template) => ({ ...template, builtIn: false }))],
      provider: {
        emailConfigured: Boolean(messageSettings?.emailFrom && (messageSettings.emailProvider === "smtp" ? messageSettings.smtpHost && messageSettings.smtpUser && messageSettings.smtpPasswordEncrypted : messageSettings.emailApiKeyEncrypted && (messageSettings.emailProvider !== "amazon-ses" || messageSettings.emailApiSecretEncrypted))),
        smsConfigured: Boolean(messageSettings?.smsAccountId && messageSettings.smsAuthSecretEncrypted && messageSettings.smsFrom),
        churchName: messageSettings?.siteName?.trim() || "St. Paul's"
      },
      audiences: { groups, manualLists: lists, dynamicLists, memberTypes: types },
      audience: { type: targetType, id: audienceId || null },
      recipientLimit
    });
  } catch {
    return NextResponse.json({ error: "Unable to load messaging recipients." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const targetType = typeof input?.targetType === "string" ? input.targetType : "selected-members";
    const audienceId = typeof input?.audienceId === "string" ? input.audienceId.trim() : "";
    const targetStatus = statusForTarget(targetType);
    const statusFilter: MembershipStatus | { not: MembershipStatus } = targetStatus ?? { not: MembershipStatus.REMOVED };
    if (audienceId && targetType === "selected-members") return NextResponse.json({ error: "Choose a named audience or omit the audience ID." }, { status: 400 });
    const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { siteName: true, membershipMessageRecipientLimit: true } });
    const recipientLimit = settings?.membershipMessageRecipientLimit ?? 200;
    const memberIds: string[] = targetStatus
      ? (await db.membershipIndividual.findMany({ where: { status: targetStatus }, select: { id: true } })).map((member) => member.id)
      : await resolveAudienceMemberIds(targetType as AudienceType, targetType === "selected-members" ? input?.memberIds : audienceId);
    const channel = input?.channel;
    const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
    const bodyHtml = typeof input?.bodyHtml === "string" ? sanitizeEmailHtml(input.bodyHtml) : "";
    const bodyText = typeof input?.bodyText === "string" ? input.bodyText.trim().slice(0, 500_000) : htmlToText(bodyHtml);
    if (!memberIds.length || !["EMAIL", "SMS"].includes(channel) || !bodyText) return NextResponse.json({ error: `Choose recipients (up to ${recipientLimit.toLocaleString()}), a channel, and a message.` }, { status: 400 });
    if (channel === "EMAIL" && (!subject || subject.length > 200)) return NextResponse.json({ error: "Email subject is required and must be 200 characters or fewer." }, { status: 400 });
    if (channel === "SMS" && bodyText.length > 1600) return NextResponse.json({ error: "SMS messages must be 1,600 characters or fewer." }, { status: 400 });

    const members = await db.membershipIndividual.findMany({ where: { id: { in: memberIds }, status: statusFilter }, select: recipientSelect });
    if (members.length > recipientLimit) return NextResponse.json({ error: `Select ${recipientLimit.toLocaleString()} or fewer members.` }, { status: 400 });
    const eligible = members.filter((member) => membershipMessageEligibility(member, channel).eligible);
    if (!eligible.length) return NextResponse.json({ error: `No selected members are eligible for ${channel === "EMAIL" ? "email" : "SMS"} messaging.` }, { status: 400 });

    const rawAttachments: unknown[] = Array.isArray(input?.attachments) ? input.attachments : [];
    if (rawAttachments.length > 10) return NextResponse.json({ error: "You can attach up to 10 files." }, { status: 400 });
    let totalBytes = 0;
    const attachments: Array<{ fileName: string; mimeType: string; sizeBytes: number; contentBase64: string }> = [];
    for (const raw of rawAttachments) {
      if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid attachment." }, { status: 400 });
      const attachment = raw as { fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown; contentBase64?: unknown };
      const fileName = typeof attachment.fileName === "string" ? attachment.fileName.trim().replace(/[\\/\0]/g, "_").slice(0, 180) : "";
      const mimeType = typeof attachment.mimeType === "string" ? attachment.mimeType : "";
      const sizeBytes = typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : 0;
      const contentBase64 = typeof attachment.contentBase64 === "string" ? attachment.contentBase64 : "";
      const dataPrefix = `data:${mimeType};base64,`;
      const encodedPayload = contentBase64.startsWith(dataPrefix) ? contentBase64.slice(dataPrefix.length) : "";
      const decodedBytes = encodedPayload ? Math.floor(encodedPayload.replace(/\s/g, "").length * 3 / 4) : 0;
      if (!fileName || !EMAIL_ATTACHMENT_TYPES.has(mimeType) || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_ATTACHMENT_BYTES || !encodedPayload || !/^[A-Za-z0-9+/=\s]+$/.test(encodedPayload) || Math.abs(decodedBytes - sizeBytes) > 2) return NextResponse.json({ error: "Attachments must be approved email-safe file types under 5 MB." }, { status: 400 });
      if (contentBase64.length > Math.ceil(sizeBytes * 1.4) + 200) return NextResponse.json({ error: "Attachment data is invalid." }, { status: 400 });
      totalBytes += sizeBytes;
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) return NextResponse.json({ error: "Attachments must total 10 MB or less." }, { status: 400 });
      attachments.push({ fileName, mimeType, sizeBytes, contentBase64 });
    }

    const message = await db.membershipMessage.create({
      data: {
        channel,
        subject: channel === "EMAIL" ? subject : null,
        bodyHtml,
        bodyText,
        status: "QUEUED",
        deliveryNote: "Sending through the configured provider.",
        createdById: user.id,
        recipients: {
          create: eligible.map((member) => ({
            individualId: member.id,
            address: (channel === "EMAIL" ? member.email : member.cellphone) as string,
            displayName: memberName(member),
            status: "PENDING"
          }))
        },
        attachments: { create: attachments }
      },
      select: { id: true, status: true, deliveryNote: true, recipients: { select: { id: true, individualId: true, address: true } } }
    });
    const deliveryResults = await Promise.all(message.recipients.map(async (recipient) => {
      const member = eligible.find((entry) => entry.id === recipient.individualId);
      const attemptedAt = new Date();
      await db.membershipMessageRecipient.update({ where: { id: recipient.id }, data: { status: "PENDING", attemptCount: { increment: 1 }, lastAttemptAt: attemptedAt, failureReason: null } });
      try {
        if (!member) throw new Error("Unable to resolve a message recipient.");
        const context = mergeContext(member, settings?.siteName?.trim() || "St. Paul's");
        const personalizedSubject = interpolateMessage(subject, context.firstName, context.lastName, context);
        const personalizedBodyText = interpolateMessage(bodyText, context.firstName, context.lastName, context);
        const personalizedBodyHtml = interpolateMessage(bodyHtml, context.firstName, context.lastName, Object.fromEntries(Object.entries(context).map(([key, value]) => [key, escapeHtml(value)])));
        if (channel === "EMAIL") {
          await sendMembershipEmail({ recipient: recipient.address, subject: personalizedSubject, bodyHtml: personalizedBodyHtml, bodyText: personalizedBodyText, attachments: attachments.map((attachment) => ({ fileName: attachment.fileName, contentBase64: attachment.contentBase64 })) });
        } else {
          await sendSmsText(recipient.address, personalizedBodyText);
        }
        await db.membershipMessageRecipient.update({ where: { id: recipient.id }, data: { status: "SENT", deliveredAt: new Date(), failureReason: null } });
        await db.membershipMessageDeliveryAttempt.create({ data: { recipientId: recipient.id, status: "SENT", attemptedAt } });
        return { ok: true };
      } catch (reason) {
        const error = reason instanceof Error ? reason.message : "Delivery failed.";
        await db.membershipMessageRecipient.update({ where: { id: recipient.id }, data: { status: "FAILED", failureReason: error.slice(0, 1000) } });
        await db.membershipMessageDeliveryAttempt.create({ data: { recipientId: recipient.id, status: "FAILED", error: error.slice(0, 1000), attemptedAt } });
        return { ok: false, error };
      }
    }));
    const sentCount = deliveryResults.filter((result) => result.ok).length;
    const failedCount = deliveryResults.length - sentCount;
    const failureMessage = deliveryResults.find((result) => !result.ok)?.error ?? "";
    const finalStatus = failedCount === 0 ? "SENT" : sentCount === 0 ? "FAILED" : "QUEUED";
    const finalNote = failedCount
        ? `${sentCount} delivered; ${failedCount} failed.${failureMessage ? ` ${failureMessage}` : ""}`
        : `${sentCount} message${sentCount === 1 ? "" : "s"} delivered through the configured provider.`;
    await db.membershipMessage.update({ where: { id: message.id }, data: { status: finalStatus, deliveryNote: finalNote } });
    await logAudit({
      activityType: "membership-message-created",
      summary: `Prepared a ${channel.toLowerCase()} message for ${eligible.length} member${eligible.length === 1 ? "" : "s"}.`,
      details: `Message ${message.id}; ${sentCount} delivered, ${failedCount} failed; ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}.`,
      actorId: user.id
    });
    return NextResponse.json({ message: { id: message.id, status: finalStatus, deliveryNote: finalNote, recipientCount: message.recipients.length }, excludedCount: members.length - eligible.length }, { status: finalStatus === "FAILED" ? 502 : 201 });
  } catch {
    return NextResponse.json({ error: "Unable to save the membership message." }, { status: 500 });
  }
}
