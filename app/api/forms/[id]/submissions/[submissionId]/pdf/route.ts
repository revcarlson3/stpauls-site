import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { normalizeFormDefinition } from "@/lib/form-config";
import { submissionPdf } from "@/lib/form-delivery";

export async function GET(_request: Request, { params }: { params: { id: string; submissionId: string } }) {
  await requirePermission("MANAGE_SETTINGS");
  const submission = await db.formSubmission.findFirst({
    where: { id: params.submissionId, formId: params.id },
    select: { values: true, createdAt: true, form: { select: { name: true, definition: true, exportSettings: true } } }
  });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  const values = submission.values && typeof submission.values === "object" && !Array.isArray(submission.values) ? submission.values as Record<string, unknown> : {};
  const definition = normalizeFormDefinition({ ...(submission.form.definition as Record<string, unknown>), exportSettings: submission.form.exportSettings });
  const pdf = await submissionPdf(submission.form.name, definition, values, submission.createdAt);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${submission.form.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "form"}-submission.pdf"`
    }
  });
}
