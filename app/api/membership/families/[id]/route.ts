import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { CustomFieldValidationError, saveCustomFieldValues, validateCustomFieldValues } from "@/lib/membership-custom-fields";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const family = await db.membershipFamily.findUnique({ where: { id: params.id }, include: { customValues: { where: { definition: { isActive: true } }, select: { definitionId: true, value: true } } } });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });
    return NextResponse.json({ family });
  } catch {
    return NextResponse.json({ error: "Unable to load family." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const family = await db.membershipFamily.findUnique({ where: { id: params.id }, select: { id: true, lastName: true, photographUrl: true } });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });
    if (new URL(_request.url).searchParams.get("photo") === "1") {
      if (family.photographUrl?.startsWith("/uploads/membership/")) await unlink(path.join(process.cwd(), "public", family.photographUrl)).catch(() => undefined);
      await db.membershipFamily.update({ where: { id: params.id }, data: { photographUrl: null } });
      return NextResponse.json({ removed: true });
    }
    await db.$transaction([
      db.membershipIndividual.updateMany({ where: { familyId: params.id }, data: { status: "REMOVED", removedAt: new Date() } }),
      db.membershipFamily.update({ where: { id: params.id }, data: { status: "REMOVED", removedAt: new Date() } })
    ]);
    await logAudit({ activityType: "membership-family-removed", summary: `Removed membership family ${family.lastName}.`, actorId: user.id });
    return NextResponse.json({ removed: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove membership family." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const family = await db.membershipFamily.findUnique({ where: { id: params.id }, select: { id: true, photographUrl: true } });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });
    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a photograph to upload." }, { status: 400 });
    const extensions: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
    const extension = extensions[file.type];
    if (!extension || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Photographs must be JPG, PNG, or WebP files no larger than 5 MB." }, { status: 400 });
    const relativePath = `/uploads/membership/${randomUUID()}${extension}`;
    const absoluteDirectory = path.join(process.cwd(), "public", "uploads", "membership");
    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(path.join(process.cwd(), "public", relativePath), Buffer.from(await file.arrayBuffer()));
    if (family.photographUrl?.startsWith("/uploads/membership/")) await unlink(path.join(process.cwd(), "public", family.photographUrl)).catch(() => undefined);
    const updated = await db.membershipFamily.update({ where: { id: params.id }, data: { photographUrl: relativePath } });
    return NextResponse.json({ family: updated });
  } catch {
    return NextResponse.json({ error: "Unable to upload family photograph." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
      const user = await requirePermission("MANAGE_MEMBERSHIP");
      await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
      const input = await request.json();
      if (!input || typeof input.lastName !== "string" || !input.lastName.trim() || typeof input.phone !== "string" || typeof input.email !== "string" || !["ACTIVE", "INACTIVE"].includes(input.status)) return NextResponse.json({ error: "Invalid family details." }, { status: 400 });
      const customFields = Object.prototype.hasOwnProperty.call(input, "customFieldValues")
        ? await validateCustomFieldValues(input.customFieldValues, "FAMILY")
        : null;
      if (input.status === "ACTIVE" && !(await db.membershipIndividual.findFirst({ where: { familyId: params.id, familyRole: { slug: "head-of-household" }, status: { not: "REMOVED" } }, select: { id: true } }))) return NextResponse.json({ error: "An active family must have a Head of Household." }, { status: 409 });
      const family = await db.$transaction(async (transaction) => {
        const updated = await transaction.membershipFamily.update({ where: { id: params.id }, data: { lastName: input.lastName.trim(), phone: input.phone.trim() || null, email: input.email.trim().toLowerCase() || null, status: input.status, formalGreeting: input.formalGreeting?.trim() || null, informalGreeting: input.informalGreeting?.trim() || null, addressStreet: input.addressStreet?.trim() || null, addressCity: input.addressCity?.trim() || null, addressState: input.addressState?.trim() || null, addressZip: input.addressZip?.trim() || null } });
        if (customFields) await saveCustomFieldValues(transaction, "FAMILY", params.id, customFields);
        return updated;
      });
      await logAudit({ activityType: "membership-family-updated", summary: `Updated membership family ${family.lastName}.`, actorId: user.id });
      return NextResponse.json({ family });
    } catch (error) {
      if (error instanceof CustomFieldValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ error: "Unable to update membership family." }, { status: 500 });
  }
}
