import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_MEMBERSHIP_DOCUMENT_SIZE, validateDocumentUpload } from "@/lib/membership-documents";
import { requireEnabledModule } from "@/lib/modules";
import { membershipAuditDetails } from "@/lib/membership-timeline";
import { requireTenantScope } from "@/lib/tenant";

const documentSelect = {
  id: true,
  originalName: true,
  category: true,
  description: true,
  memberVisible: true,
  mimeType: true,
  sizeBytes: true,
  expiresAt: true,
  createdAt: true
} as const;

function documentResponse(document: { id: string; originalName: string; mimeType: string; sizeBytes: number; expiresAt: Date | null; createdAt: Date }, familyId: string) {
  return {
    ...document,
    downloadUrl: `/api/membership/families/${familyId}/documents/${document.id}`
  };
}

async function authorize() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  return user;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const scope = await requireTenantScope();
    const family = await db.membershipFamily.findUnique({
      where: { id: params.id, churchId: scope.church.id },
      select: {
        id: true,
        documents: { orderBy: { createdAt: "desc" }, select: documentSelect }
      }
    });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });
    return NextResponse.json({ documents: family.documents.map((document) => documentResponse(document, family.id)) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load family documents.");
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let writtenPath: string | null = null;
  try {
    const user = await authorize();
    const scope = await requireTenantScope();
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MEMBERSHIP_DOCUMENT_SIZE + 1024 * 1024) {
      return NextResponse.json({ error: "Documents must be no larger than 10 MB." }, { status: 413 });
    }

    const family = await db.membershipFamily.findFirst({ where: { id: params.id, churchId: scope.church.id }, select: { id: true, lastName: true } });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("document");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });

    const contents = Buffer.from(await file.arrayBuffer());
    const validation = validateDocumentUpload(file.name, file.type, contents);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const storageKey = `${randomUUID()}${validation.storageExtension}`;
    const directory = path.join(process.cwd(), "storage", "membership-documents");
    writtenPath = path.join(directory, storageKey);
    await mkdir(directory, { recursive: true });
    await writeFile(writtenPath, contents, { flag: "wx" });

    const document = await db.membershipDocument.create({
      data: {
        familyId: family.id,
        originalName: validation.originalName,
        storageKey,
        mimeType: validation.mimeType,
        sizeBytes: contents.length,
        category: typeof formData.get("category") === "string" ? String(formData.get("category")).slice(0, 40) || "OTHER" : "OTHER",
        description: typeof formData.get("description") === "string" ? String(formData.get("description")).trim().slice(0, 500) || null : null,
        memberVisible: formData.get("memberVisible") !== "false"
      },
      select: documentSelect
    });
    writtenPath = null;
    await logAudit({
      activityType: "membership-document-uploaded",
      summary: `Uploaded “${document.originalName}” for the ${family.lastName} family.`,
      details: membershipAuditDetails({ familyId: family.id, documentId: document.id }),
      actorId: user.id
    });
    return NextResponse.json({ document: documentResponse(document, family.id) }, { status: 201 });
  } catch (error) {
    if (writtenPath) await unlink(writtenPath).catch(() => undefined);
    return apiErrorResponse(error, "Unable to upload family document.");
  }
}
