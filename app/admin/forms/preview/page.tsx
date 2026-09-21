"use client";

import { useEffect, useState } from "react";
import { FormRenderer, type PublicForm } from "@/components/form-renderer";
import { Container } from "@/components/ui";
import { normalizeFormDefinition } from "@/lib/form-config";

export default function FormPreviewPage() {
  const [form, setForm] = useState<PublicForm | null>(null);
  useEffect(() => {
    const raw = window.localStorage.getItem("stpauls-form-preview");
    if (!raw) return;
    try {
      const value = JSON.parse(raw) as { id?: unknown; name?: unknown; definition?: unknown };
      if (value.definition) setForm({ id: typeof value.id === "string" ? value.id : "preview", name: typeof value.name === "string" ? value.name : "Form preview", definition: normalizeFormDefinition(value.definition) });
    } catch {
      setForm(null);
    }
  }, []);
  return <main className="min-h-screen bg-sand py-10 sm:py-16"><Container className="max-w-3xl"><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">Preview</p><h1 className="mt-2 font-serif text-4xl">{form?.name || "Form preview"}</h1><p className="mt-2 text-sm text-ink/60">This preview uses the current builder state. Submissions are not sent.</p></div>{form ? <FormRenderer formId={form.id} previewDefinition={form} /> : <p className="rounded-lg border border-ink/10 bg-white p-6 text-sm text-ink/60">No preview is available. Return to the builder and select Preview.</p>}</Container></main>;
}
