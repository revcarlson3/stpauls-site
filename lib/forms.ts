import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { normalizeFormDefinition, publicFormDefinition, type FormDefinition } from "@/lib/form-config";

export type FormInput = {
  name: string;
  slug: string;
  status?: string;
  enabled?: boolean;
  definition: FormDefinition;
  notificationSettings?: Record<string, unknown>;
  exportSettings?: Record<string, unknown>;
};

export function formStatus(value: unknown) {
  return value === "PUBLISHED" || value === "ARCHIVED" ? value : "DRAFT";
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function listForms() {
  await requirePermission("EDIT_PAGES");
  return db.form.findMany({ orderBy: [{ updatedAt: "desc" }], select: { id: true, name: true, slug: true, status: true, enabled: true, definition: true, notificationSettings: true, exportSettings: true, createdAt: true, updatedAt: true, _count: { select: { submissions: true } } } });
}

export async function getForm(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.form.findUnique({ where: { id } });
}

export async function createForm(input: FormInput) {
  await requirePermission("EDIT_PAGES");
  return db.form.create({ data: { name: input.name, slug: input.slug, status: input.status ?? "DRAFT", enabled: input.enabled ?? true, definition: json(normalizeFormDefinition(input.definition)), notificationSettings: json(input.notificationSettings ?? {}), exportSettings: json(input.exportSettings ?? {}) } });
}

export async function updateForm(id: string, input: FormInput) {
  await requirePermission("EDIT_PAGES");
  return db.form.update({ where: { id }, data: { name: input.name, slug: input.slug, status: input.status ?? "DRAFT", enabled: input.enabled ?? true, definition: json(normalizeFormDefinition(input.definition)), notificationSettings: json(input.notificationSettings ?? {}), exportSettings: json(input.exportSettings ?? {}) } });
}

export async function deleteForm(id: string) {
  await requirePermission("EDIT_PAGES");
  return db.form.delete({ where: { id } });
}

export async function getPublicForm(id: string) {
  const form = await db.form.findFirst({ where: { id, enabled: true, status: "PUBLISHED" }, select: { id: true, name: true, definition: true } });
  return form ? { id: form.id, name: form.name, definition: publicFormDefinition(form.definition) } : null;
}

export async function listSubmissions(formId: string) {
  await requirePermission("MANAGE_SETTINGS");
  return db.formSubmission.findMany({ where: { formId }, orderBy: { createdAt: "desc" }, take: 500, select: { id: true, values: true, metadata: true, createdAt: true } });
}
