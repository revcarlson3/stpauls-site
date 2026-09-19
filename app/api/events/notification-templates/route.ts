import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { htmlToText, sanitizeEmailHtml } from "@/lib/membership-messaging";
import { requireTenantScope } from "@/lib/tenant";

const SMS_MAX_LENGTH = 1600;
const defaults = {
  emailSubject: "You are scheduled to serve at {{eventName}}",
  emailBodyHtml: "<p>Hello {{volunteerName}},</p><p>You are scheduled to serve with {{volunteerGroupName}} at {{eventName}} on {{eventDate}} at {{eventTime}}.</p><p>Thank you for serving!</p>",
  emailDayBeforeSubject: "Reminder: you are serving tomorrow",
  emailDayBeforeBodyHtml: "<p>Hello {{volunteerName}},</p><p>This is a reminder that you are scheduled to serve with {{volunteerGroupName}} at {{eventName}} tomorrow at {{eventTime}}.</p>",
  smsBody: "{{volunteerName}}, you are scheduled with {{volunteerGroupName}} for {{eventName}} on {{eventDate}} at {{eventTime}}.",
  smsDayBeforeBody: "Reminder: {{volunteerName}}, you are serving with {{volunteerGroupName}} at {{eventName}} tomorrow at {{eventTime}}."
};

async function authorize() {
  const user = await requirePermission("MANAGE_EVENTS");
  await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
  return user;
}

async function getOrCreateTemplate(groupId: string | null, churchId: string) {
  const existing = await db.membershipEventNotificationTemplate.findFirst({ where: { groupId, churchId } });
  if (existing) return existing;
  const highest = await db.membershipEventNotificationTemplate.aggregate({ _max: { id: true } });
  return db.membershipEventNotificationTemplate.create({ data: { id: (highest._max.id ?? 0) + 1, churchId, groupId, ...defaults } });
}

export async function GET(request: Request) {
  try {
    await authorize();
    const scope = await requireTenantScope();
    const groupId = new URL(request.url).searchParams.get("groupId") || null;
    if (groupId && !(await db.membershipVolunteerGroup.findFirst({ where: { id: groupId, churchId: scope.church.id }, select: { id: true } }))) {
      return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
    }
    const [template, groups] = await Promise.all([
      getOrCreateTemplate(groupId, scope.church.id),
      db.membershipVolunteerGroup.findMany({ where: { churchId: scope.church.id }, orderBy: { position: "asc" }, select: { id: true, name: true, singularName: true } })
    ]);
    return NextResponse.json({ template, groups });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load event notification templates.");
  }
}

export async function PATCH(request: Request) {
  try {
    await authorize();
    const scope = await requireTenantScope();
    const input = await request.json();
    const groupId = input?.groupId === null || input?.groupId === undefined || input?.groupId === "" ? null : typeof input?.groupId === "string" ? input.groupId : undefined;
    if (groupId === undefined) return NextResponse.json({ error: "Invalid volunteer group." }, { status: 400 });
    const emailBodyHtml = typeof input?.emailBodyHtml === "string" ? sanitizeEmailHtml(input.emailBodyHtml) : "";
    const emailDayBeforeBodyHtml = typeof input?.emailDayBeforeBodyHtml === "string" ? sanitizeEmailHtml(input.emailDayBeforeBodyHtml) : "";
    const values = {
      emailSubject: typeof input?.emailSubject === "string" ? input.emailSubject.trim().slice(0, 200) : "",
      emailBodyHtml,
      emailDayBeforeSubject: typeof input?.emailDayBeforeSubject === "string" ? input.emailDayBeforeSubject.trim().slice(0, 200) : "",
      emailDayBeforeBodyHtml,
      smsBody: typeof input?.smsBody === "string" ? input.smsBody.slice(0, SMS_MAX_LENGTH) : "",
      smsDayBeforeBody: typeof input?.smsDayBeforeBody === "string" ? input.smsDayBeforeBody.slice(0, SMS_MAX_LENGTH) : ""
    };
    if (!values.emailSubject || !htmlToText(values.emailBodyHtml) || !values.emailDayBeforeSubject || !htmlToText(values.emailDayBeforeBodyHtml) || !values.smsBody.trim() || !values.smsDayBeforeBody.trim()) {
      return NextResponse.json({ error: "Each notification template needs content before it can be saved." }, { status: 400 });
    }
    if (groupId) {
      const group = await db.membershipVolunteerGroup.findFirst({ where: { id: groupId, churchId: scope.church.id }, select: { id: true } });
      if (!group) return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
    }
    const existing = await db.membershipEventNotificationTemplate.findFirst({ where: { groupId, churchId: scope.church.id } });
    const template = existing
      ? await db.membershipEventNotificationTemplate.update({ where: { id: existing.id }, data: values })
      : await db.membershipEventNotificationTemplate.create({ data: { id: ((await db.membershipEventNotificationTemplate.aggregate({ _max: { id: true } }))._max.id ?? 0) + 1, churchId: scope.church.id, groupId, ...values } });
    return NextResponse.json({ template });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save event notification templates.");
  }
}
