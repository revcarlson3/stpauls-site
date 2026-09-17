import { readFile, unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentDownloadDisposition, isSafeDocumentStorageKey, parseMembershipDocumentExpiry } from "@/lib/membership-documents";
import { requireEnabledModule } from "@/lib/modules";
import { membershipAuditDetails } from "@/lib/membership-timeline";

async function authorizeManager() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return user;
}

async function authorizeDownload(familyId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: sign-in required.");
  if (user.permissions.includes("MANAGE_MEMBERSHIP")) {
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    return user;
  }
  if (!user.permissions.includes("MY_MEMBERSHIP")) throw new Error("Unauthorized: membership access is not enabled.");
  const link = await db.membershipUserMemberLink.findFirst({
    where: { userId: user.id, individual: { familyId } },
    select: { id: true }
  });
  if (!link) throw new Error("Unauthorized: this document is not available to the account.");
  await requireEnabledModule("membership", user.id, "MY_MEMBERSHIP");
  return user;
}

async function findDocument(familyId: string, documentId: string) {
  return db.membershipDocument.findFirst({
    where: { id: documentId, familyId },
    select: {
      id: true,
      originalName: true,
      category: true,
      description: true,
      memberVisible: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      expiresAt: true,
      createdAt: true,
      family: { select: { lastName: true } }
    }
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string; documentId: string } }) {
  try {
    const user = await authorizeManager();
    const body = await request.json();
    const parsed = parseMembershipDocumentExpiry(body.expiresAt);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const existing = await findDocument(params.id, params.documentId);
    if (!existing) return NextResponse.json({ error: "Family document not found." }, { status: 404 });

    const document = await db.membershipDocument.update({
      where: { id: existing.id },
      data: {
        expiresAt: parsed.expiresAt,
        ...(typeof body.category === "string" ? { category: body.category.trim().slice(0, 40) || "OTHER" } : {}),
        ...(typeof body.description === "string" ? { description: body.description.trim().slice(0, 500) || null } : {}),
        ...(typeof body.memberVisible === "boolean" ? { memberVisible: body.memberVisible } : {})
      },
      select: {
        id: true,
        originalName: true,
        category: true,
        description: true,
        memberVisible: true,
        mimeType: true,
        sizeBytes: true,
        expiresAt: true,
        createdAt: true
      }
    });
    await logAudit({
      activityType: "membership-document-retention-updated",
      summary: parsed.expiresAt
        ? `Set “${document.originalName}” to expire after ${parsed.expiresAt.toISOString().slice(0, 10)}.`
        : `Cleared the expiry for “${document.originalName}”.`,
      details: membershipAuditDetails({ familyId: params.id, documentId: document.id }),
      actorId: user.id
    });
    return NextResponse.json({
      document: {
        ...document,
        downloadUrl: `/api/membership/families/${params.id}/documents/${document.id}`
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to update document retention." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: { id: string; documentId: string } }) {
  try {
    const user = await authorizeDownload(params.id);
    const document = await findDocument(params.id, params.documentId);
    if (!document || !isSafeDocumentStorageKey(document.storageKey)) {
      return NextResponse.json({ error: "Family document not found." }, { status: 404 });
    }
    if (document.expiresAt && document.expiresAt <= new Date()) {
      return NextResponse.json({ error: "This document has expired." }, { status: 404 });
    }
    if (!user.permissions.includes("MANAGE_MEMBERSHIP") && !document.memberVisible) {
      return NextResponse.json({ error: "Family document not found." }, { status: 404 });
    }

    const contents = await readFile(path.join(process.cwd(), "storage", "membership-documents", document.storageKey));
    await logAudit({
      activityType: "membership-document-downloaded",
      summary: `Downloaded “${document.originalName}” for the ${document.family.lastName} family.`,
      details: membershipAuditDetails({ familyId: params.id, documentId: document.id }),
      actorId: user.id
    });
    return new Response(new Uint8Array(contents), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(contents.length),
        "Content-Disposition": documentDownloadDisposition(document.originalName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to download family document." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string; documentId: string } }) {
  try {
    const user = await authorizeManager();
    const document = await findDocument(params.id, params.documentId);
    if (!document) return NextResponse.json({ error: "Family document not found." }, { status: 404 });

    await db.$transaction(async (transaction) => {
      await transaction.membershipDocument.delete({ where: { id: document.id } });
      await transaction.auditLog.create({
        data: {
          activityType: "membership-document-deleted",
          summary: `Deleted “${document.originalName}” from the ${document.family.lastName} family.`,
          details: membershipAuditDetails({ familyId: params.id, documentId: document.id, reason: "manual-deletion" }),
          actorId: user.id
        }
      });
    });
    if (isSafeDocumentStorageKey(document.storageKey)) {
      await unlink(path.join(process.cwd(), "storage", "membership-documents", document.storageKey)).catch(() => undefined);
    }
    return NextResponse.json({ removed: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete family document." }, { status: 500 });
  }
}
