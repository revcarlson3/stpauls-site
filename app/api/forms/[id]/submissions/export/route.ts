import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeFormDefinition } from "@/lib/form-config";
import { requirePermission } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const form = await db.form.findUnique({ where: { id: params.id }, select: { name: true, definition: true, exportSettings: true } });
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const definition = normalizeFormDefinition(form.definition);
    const settings = form.exportSettings && typeof form.exportSettings === "object" && !Array.isArray(form.exportSettings) ? form.exportSettings as Record<string, unknown> : {};
    const allFields = definition.steps.flatMap((step) => step.fields).filter((field) => !["section-break", "submit", "cancel", "next", "previous", "custom-html"].includes(field.type));
    const orderedNames = Array.isArray(settings.fieldOrder) ? settings.fieldOrder.filter((value): value is string => typeof value === "string") : [];
    const fields = orderedNames.length ? [...orderedNames.map((name) => allFields.find((field) => field.name === name)).filter((field): field is typeof allFields[number] => Boolean(field)), ...allFields.filter((field) => !orderedNames.includes(field.name))] : allFields;
    const submissions = await db.formSubmission.findMany({ where: { formId: params.id }, orderBy: { createdAt: "desc" }, take: 5000, select: { values: true, createdAt: true } });
    const includeMetadata = settings.includeMetadata !== false;
    const header = [...(includeMetadata ? ["Submitted at"] : []), ...fields.map((field) => field.label)];
    const rows = submissions.map((submission) => {
      const values = submission.values && typeof submission.values === "object" && !Array.isArray(submission.values) ? submission.values as Record<string, unknown> : {};
      const submittedAt = settings.csvDateFormat === "local" ? submission.createdAt.toLocaleString() : submission.createdAt.toISOString();
      return [...(includeMetadata ? [submittedAt] : []), ...fields.map((field) => { const raw = values[field.name]; return Array.isArray(raw) ? raw.join("; ") : String(raw ?? ""); })];
    });
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")).join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${form.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "form"}-submissions.csv"` } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
