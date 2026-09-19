import { apiErrorResponse } from "@/lib/api-errors";
import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSafeDocumentStorageKey, parseMembershipDocumentCleanupRequest } from "@/lib/membership-documents";
import { requireEnabledModule } from "@/lib/modules";
import { membershipAuditDetails } from "@/lib/membership-timeline";
import { requireTenantScope } from "@/lib/tenant";

const previewSelect = {
  id: true,
  originalName: true,
  sizeBytes: true,
  expiresAt: true,
  familyId: true,
  family: { select: { lastName: true } }
} as const;

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return user;
}

async function expiredSummary(cutoff: Date, churchId: string) {
  const where = { expiresAt: { lte: cutoff }, family: { churchId } };
  const [count, totals, documents] = await Promise.all([
    db.membershipDocument.count({ where }),
    db.membershipDocument.aggregate({ where, _sum: { sizeBytes: true } }),
    db.membershipDocument.findMany({
      where,
      orderBy: { expiresAt: "asc" },
      take: 100,
      select: previewSelect
    })
  ]);
  return {
    count,
    sizeBytes: totals._sum.sizeBytes ?? 0,
    documents,
    truncated: count > documents.length
  };
}

export async function GET() {
  try {
    await authorize();
    const scope = await requireTenantScope();
    const cutoff = new Date();
    const summary = await expiredSummary(cutoff, scope.church.id);
    return NextResponse.json({
      asOf: cutoff.toISOString(),
      automaticCleanupEnabled: false,
      expiredCount: summary.count,
      expiredSizeBytes: summary.sizeBytes,
      documents: summary.documents,
      truncated: summary.truncated
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to preview expired membership documents.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authorize();
    const scope = await requireTenantScope();
    const body = await request.json();
    const parsed = parseMembershipDocumentCleanupRequest(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { cutoff } = parsed;

    const candidates = await db.membershipDocument.findMany({
      where: { expiresAt: { lte: cutoff }, family: { churchId: scope.church.id } },
      orderBy: { expiresAt: "asc" },
      select: { ...previewSelect, storageKey: true }
    });
    let deletedCount = 0;
    let deletedSizeBytes = 0;
    let storageCleanupFailures = 0;

    for (const document of candidates) {
      const deleted = await db.$transaction(async (transaction) => {
        const result = await transaction.membershipDocument.deleteMany({
          where: { id: document.id, expiresAt: { lte: cutoff }, family: { churchId: scope.church.id } }
        });
        if (!result.count) return false;
        await transaction.auditLog.create({
          data: {
            activityType: "membership-document-deleted",
            summary: `Deleted expired document “${document.originalName}” from the ${document.family.lastName} family.`,
            details: membershipAuditDetails({
              familyId: document.familyId,
              documentId: document.id,
              reason: "retention-cleanup"
            }),
            actorId: user.id
          }
        });
        return true;
      });
      if (!deleted) continue;

      deletedCount += 1;
      deletedSizeBytes += document.sizeBytes;
      if (isSafeDocumentStorageKey(document.storageKey)) {
        try {
          await unlink(path.join(process.cwd(), "storage", "membership-documents", document.storageKey));
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
          if (code !== "ENOENT") storageCleanupFailures += 1;
        }
      }
    }

    return NextResponse.json({ deletedCount, deletedSizeBytes, storageCleanupFailures });
  } catch (error) {
    return apiErrorResponse(error, "Unable to clean up expired membership documents.");
  }
}
