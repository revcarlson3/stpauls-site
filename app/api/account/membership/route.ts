import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureEditableFields, requestMemberLink } from "@/lib/membership-member-links";
import { logAudit } from "@/lib/audit";
import { CustomFieldValidationError, saveCustomFieldValues, validateCustomFieldValues } from "@/lib/membership-custom-fields";
import { removeMembershipPhoto } from "@/lib/membership-photo";

const individualFields = new Set(["firstName", "middleName", "calledByName", "lastName", "email", "cellphone", "otherPhone", "weddingDate", "deceasedDate"]);
const dateFields = new Set(["weddingDate", "deceasedDate"]);
const familyFields = new Set(["addressStreet", "secondaryStreet", "addressCity", "addressState", "addressZip", "familyPhone", "familyEmail"]);

function parseDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CustomFieldValidationError(`Enter a valid date for "${field}".`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CustomFieldValidationError(`Enter a valid date for "${field}".`);
  return date;
}

async function getLink() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: sign-in required.");
  const link = await db.membershipUserMemberLink.findUnique({
    where: { userId: user.id },
    include: {
      individual: { include: { family: { include: { customValues: { include: { definition: true } } } }, familyRole: true, customValues: { include: { definition: true } } } }
    }
  });
  if (!link) {
    const pendingRequest = await db.membershipLinkRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true }
    });
    return { user, link: null, pendingRequest };
  }
  const group = await db.securityGroup.findUnique({ where: { id: user.effectiveGroupId ?? "" }, select: { permissions: { where: { permission: "MY_MEMBERSHIP" }, select: { permission: true } } } });
  if (!group?.permissions.length) throw new Error("Unauthorized: membership access is not enabled for this account.");
  const [fields, customDefinitions] = await Promise.all([
    ensureEditableFields(),
    db.membershipCustomFieldDefinition.findMany({ where: { isActive: true }, select: { id: true, appliesTo: true, type: true } })
  ]);
  return { user, link, fields, customDefinitions };
}

export async function GET() {
  try {
    const result = await getLink();
    if (!result.link) return NextResponse.json({ linked: false, pendingRequest: result.pendingRequest ?? null });
    const typeByFieldKey = new Map(result.customDefinitions?.map((definition) => [`customField:${definition.id}`, definition.type]));
    return NextResponse.json({ linked: true, individual: result.link.individual, fields: result.fields?.filter((field) => field.enabled).map((field) => ({ ...field, type: typeByFieldKey.get(field.fieldKey) ?? null })) ?? [], canEditFamily: result.link.individual.familyRole.slug === "head-of-household" });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to load membership profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const result = await getLink();
    if (!result.link) return NextResponse.json({ error: "No membership record is linked to this account." }, { status: 404 });
    const input = await request.json();
    const enabled = new Set((result.fields ?? []).filter((field) => field.enabled).map((field) => field.fieldKey));
    const individualData: Record<string, string | Date | null> = {};
    const familyData: Record<string, string | null> = {};
    const individualCustomInput: Record<string, unknown> = {};
    const familyCustomInput: Record<string, unknown> = {};
    const enabledCustomFields = new Set((result.fields ?? []).filter((field) => field.enabled && field.fieldKey.startsWith("customField:")).map((field) => field.fieldKey.slice("customField:".length)));
    for (const [key, value] of Object.entries(input ?? {})) {
      if (typeof value !== "string") continue;
      if (key.startsWith("customField:") && enabledCustomFields.has(key.slice("customField:".length))) {
        const definitionId = key.slice("customField:".length);
        const definition = result.customDefinitions?.find((entry) => entry.id === definitionId);
        if (definition?.appliesTo === "INDIVIDUAL") individualCustomInput[definitionId] = value;
        if (definition?.appliesTo === "FAMILY" && result.link.individual.familyRole.slug === "head-of-household") familyCustomInput[definitionId] = value;
        continue;
      }
      if (individualFields.has(key) && enabled.has(key)) {
        if (dateFields.has(key)) {
          if (value.trim() === "") individualData[key] = null;
          else individualData[key] = parseDate(value, key);
        } else individualData[key] = value.trim() || null;
      }
      if (familyFields.has(key) && enabled.has(key) && result.link.individual.familyRole.slug === "head-of-household") {
        const mapped = key === "familyPhone" ? "phone" : key === "familyEmail" ? "email" : key;
        familyData[mapped] = value.trim() || null;
      }

    }
    if (!Object.keys(individualData).length && !Object.keys(familyData).length) return NextResponse.json({ error: "No editable fields were provided." }, { status: 400 });
    const individualCustomValues = [...result.link.individual.customValues.map((entry) => [entry.definitionId, entry.value] as const)];
    const familyCustomValues = [...result.link.individual.family.customValues.map((entry) => [entry.definitionId, entry.value] as const)];
    for (const [definitionId, value] of Object.entries(individualCustomInput)) {
      const index = individualCustomValues.findIndex(([id]) => id === definitionId);
      if (index >= 0) individualCustomValues[index] = [definitionId, value as string];
      else individualCustomValues.push([definitionId, value as string]);
    }
    for (const [definitionId, value] of Object.entries(familyCustomInput)) {
      const index = familyCustomValues.findIndex(([id]) => id === definitionId);
      if (index >= 0) familyCustomValues[index] = [definitionId, value as string];
      else familyCustomValues.push([definitionId, value as string]);
    }
    const individualCustom = Object.keys(individualCustomInput).length ? await validateCustomFieldValues(Object.fromEntries(individualCustomValues), "INDIVIDUAL") : null;
    const familyCustom = Object.keys(familyCustomInput).length ? await validateCustomFieldValues(Object.fromEntries(familyCustomValues), "FAMILY") : null;
    const updated = await db.$transaction(async (tx) => {
      const individual = Object.keys(individualData).length ? await tx.membershipIndividual.update({ where: { id: result.link!.individualId }, data: individualData }) : result.link!.individual;
      if (Object.keys(familyData).length) await tx.membershipFamily.update({ where: { id: result.link!.individual.familyId }, data: familyData });
      if (individualCustom) await saveCustomFieldValues(tx, "INDIVIDUAL", result.link!.individualId, individualCustom);
      if (familyCustom) await saveCustomFieldValues(tx, "FAMILY", result.link!.individual.familyId, familyCustom);
      return individual;
    });
    await logAudit({ activityType: "membership-individual-updated", summary: `Member self-service updated ${updated.firstName} ${updated.lastName}.`, actorId: result.user.id });
    return NextResponse.json({ individual: updated });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    if (error instanceof CustomFieldValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update membership profile." }, { status: 400 });
  }

}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await request.json();
      if (input?.action !== "request-link") return NextResponse.json({ error: "Invalid membership request." }, { status: 400 });
      return NextResponse.json(await requestMemberLink(), { status: 201 });
    }

    const result = await getLink();
    if (!result.link || !result.fields?.some((field) => field.fieldKey === "familyPhotographUrl" && field.enabled) || result.link.individual.familyRole.slug !== "head-of-household") return NextResponse.json({ error: "Family photograph editing is not enabled for this account." }, { status: 403 });
    const file = (await request.formData()).get("photo");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a photograph to upload." }, { status: 400 });
    const extension = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as Record<string, string>)[file.type];
    if (!extension || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Photographs must be JPG, PNG, or WebP files no larger than 5 MB." }, { status: 400 });
    const filename = `${randomUUID()}${extension}`;
    await mkdir(path.join(process.cwd(), "storage", "membership"), { recursive: true });
    await writeFile(path.join(process.cwd(), "storage", "membership", filename), Buffer.from(await file.arrayBuffer()));
    await removeMembershipPhoto(result.link.individual.family.photographUrl);
    const relativePath = `/api/membership/families/${result.link.individual.familyId}/photo?file=${encodeURIComponent(filename)}`;
    await db.membershipFamily.update({ where: { id: result.link.individual.familyId }, data: { photographUrl: relativePath } });
    await logAudit({ activityType: "membership-family-updated", summary: "Member self-service uploaded a family photograph.", actorId: result.user.id });
    return NextResponse.json({ photographUrl: relativePath });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to upload family photograph." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const result = await getLink();
    if (!result.link || !result.fields?.some((field) => field.fieldKey === "familyPhotographUrl" && field.enabled) || result.link.individual.familyRole.slug !== "head-of-household") {
      return NextResponse.json({ error: "Family photograph editing is not enabled for this account." }, { status: 403 });
    }
    await removeMembershipPhoto(result.link.individual.family.photographUrl);
    await db.membershipFamily.update({ where: { id: result.link.individual.familyId }, data: { photographUrl: null } });
    await logAudit({ activityType: "membership-family-updated", summary: "Member self-service removed the family photograph.", actorId: result.user.id });
    return NextResponse.json({ photographUrl: null });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to remove family photograph." }, { status: 400 });
  }
}
