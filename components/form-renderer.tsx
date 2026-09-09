"use client";

import { useEffect, useRef, useState } from "react";
import { countryOptions, formFieldConditionsMatch, sanitizeFormHtml, usStateOptions, type FormDefinition, type FormField } from "@/lib/form-config";

export type PublicForm = { id: string; name: string; definition: FormDefinition };

function submissionPayload(values: Record<string, unknown>) {
  const files: { fieldName: string; file: File }[] = [];
  const serializable: Record<string, unknown> = {};
  for (const [fieldName, value] of Object.entries(values)) {
    const candidates = Array.isArray(value) ? value : [value];
    const hasFiles = candidates.some((candidate) => typeof File !== "undefined" && candidate instanceof File);
    if (hasFiles) {
      const fieldFiles = candidates.filter((candidate): candidate is File => typeof File !== "undefined" && candidate instanceof File);
      fieldFiles.forEach((file) => files.push({ fieldName, file }));
      serializable[fieldName] = fieldFiles.length > 1
        ? fieldFiles.map((file) => ({ name: file.name, size: file.size, type: file.type }))
        : fieldFiles[0] ? { name: fieldFiles[0].name, size: fieldFiles[0].size, type: fieldFiles[0].type } : "";
    } else {
      serializable[fieldName] = value;
    }
  }
  return { values: serializable, files };
}

function findFieldStep(fields: FormField[], target: string): boolean {
  return fields.some((field) => {
    if (target === field.name || target.startsWith(`${field.name}.`)) return true;
    const nested = Array.isArray(field.settings?.items) ? field.settings.items.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && Array.isArray((item as { fields?: unknown }).fields) ? (item as { fields: FormField[] }).fields : []) : [];
    const columns = Array.isArray(field.settings?.columnFields) ? field.settings.columnFields.flatMap((column) => Array.isArray(column) ? column as FormField[] : []) : [];
    return findFieldStep([...nested, ...columns], target);
  });
}

export function FormRenderer({ formId, title, alignment = "left", previewDefinition }: { formId: string; title?: string; alignment?: "left" | "center" | "right"; previewDefinition?: PublicForm }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "submitted">("loading");
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (previewDefinition) {
      setForm(previewDefinition);
      setStatus("ready");
      return;
    }
    let active = true;
    void fetch(`/api/forms/${encodeURIComponent(formId)}/public`).then(async (response) => {
      if (!response.ok) throw new Error("This form is not available.");
      const result = await response.json() as PublicForm;
      if (active) { setForm(result); setStatus("ready"); }
    }).catch((error: Error) => { if (active) { setMessage(error.message); setStatus("error"); } });
    return () => { active = false; };
  }, [formId, previewDefinition]);
  useEffect(() => {
    if (!form?.definition.steps.some((stepItem) => stepItem.fields.some((field) => field.type === "button" && field.settings?.loggedInOnly === true))) return;
    void fetch("/api/account").then((response) => setIsAuthenticated(response.ok)).catch(() => setIsAuthenticated(false));
  }, [form]);

  const currentStep = form?.definition.steps[step];
  const hasButtonFields = currentStep?.fields.some((field) => field.type === "button") === true;
  const resetForm = () => { setValues({}); setErrors({}); setMessage(""); setStep(0); setFileInputKey((value) => value + 1); };
  const setValue = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => { const next = { ...current }; delete next[name]; return next; });
  };
  const validateStep = () => {
    if (!currentStep) return true;
    const next: Record<string, string> = {};
    for (const field of currentStep.fields) {
      if (field.type === "name" || field.type === "address") {
        const groupValue = values[field.name] && typeof values[field.name] === "object" && !Array.isArray(values[field.name]) ? values[field.name] as Record<string, unknown> : {};
        const configs = field.settings?.fields && typeof field.settings.fields === "object" && !Array.isArray(field.settings.fields) ? field.settings.fields as Record<string, unknown> : {};
        for (const [name, rawConfig] of Object.entries(configs)) {
          const config = rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) ? rawConfig as Record<string, unknown> : {};
          if (config.enabled !== false && config.required === true && !groupValue[name]) next[`${field.name}.${name}`] = "This field is required.";
        }
        continue;
      }
      if (!field.required || ["section-break", "custom-html", "button"].includes(field.type) || (field.type === "terms" && field.settings?.showCheckbox === false)) continue;
      const value = values[field.name];
      if (value === undefined || value === "" || value === false || (Array.isArray(value) && value.length === 0)) next[field.name] = "This field is required.";
    }
    setErrors((current) => ({ ...current, ...next }));
    return Object.keys(next).length === 0;
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateStep() || !form) return;
    if (previewDefinition) {
      setMessage("Preview submission complete. No data was saved or emailed.");
      setStatus("submitted");
      return;
    }
    const honeypot = ((event.currentTarget as HTMLFormElement).elements.namedItem("_website") as HTMLInputElement | null)?.value;
    setStatus("loading");
    const prepared = submissionPayload(values);
    const payload = { values: prepared.values, _website: honeypot, referrer: typeof document === "undefined" ? "" : document.referrer };
    const requestBody = prepared.files.length ? (() => {
      const body = new FormData();
      body.set("payload", JSON.stringify(payload));
      prepared.files.forEach(({ fieldName, file }) => body.append(`file:${fieldName}`, file, file.name));
      return body;
    })() : JSON.stringify(payload);
    const response = await fetch(`/api/forms/${encodeURIComponent(form.id)}/submissions`, { method: "POST", headers: prepared.files.length ? undefined : { "Content-Type": "application/json" }, body: requestBody });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fieldErrors = result.fields && typeof result.fields === "object" && !Array.isArray(result.fields) ? result.fields as Record<string, string> : {};
      setErrors(fieldErrors);
      const firstError = Object.keys(fieldErrors)[0];
      if (firstError) {
        const errorStep = form.definition.steps.findIndex((stepItem) => findFieldStep(stepItem.fields, firstError));
        if (errorStep >= 0) setStep(errorStep);
      }
      setMessage(result.error ?? form.definition.failureMessage); setStatus("ready"); return;
    }
    if (form.definition.resetOnSubmit) resetForm();
    const confirmation = result.warning ? `${result.message ?? form.definition.confirmationMessage} ${result.warning}` : result.message ?? form.definition.confirmationMessage;
    if (!previewDefinition && form.definition.confirmationMode === "redirect" && form.definition.confirmationRedirectUrl) {
      window.location.assign(form.definition.confirmationRedirectUrl);
      return;
    }
    setMessage(confirmation); setStatus("submitted");
  }
  const alignmentClass = alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left";
  if (status === "loading" && !form) return <div role="status" className="rounded-lg border border-ink/10 bg-white/60 p-6 text-sm text-ink/60">Loading form…</div>;
  if (status === "error" || !form) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">{message || "This form is unavailable."}</div>;
  if (status === "submitted") return <div role="status" className={`rounded-lg border border-green-200 bg-green-50 p-6 text-green-900 ${alignmentClass}`}>{form.definition.confirmationTitle && <h2 className="font-serif text-2xl">{form.definition.confirmationTitle}</h2>}<p className={form.definition.confirmationTitle ? "mt-2" : ""}>{message}</p></div>;
  return <form data-form-style={form.definition.style} data-form-radius={form.definition.style === "custom" ? form.definition.styleSettings.radius : undefined} data-form-density={form.definition.style === "custom" ? form.definition.styleSettings.density : undefined} data-form-label-weight={form.definition.style === "custom" ? form.definition.styleSettings.labelWeight : undefined} style={form.definition.style === "custom" ? {
    "--form-accent": form.definition.styleSettings.accentColor,
    "--form-text": form.definition.styleSettings.textColor,
    "--form-surface": form.definition.styleSettings.surfaceColor,
    "--form-border": form.definition.styleSettings.borderColor
  } as React.CSSProperties : undefined} className={`form-style-${form.definition.style} grid gap-5 ${alignmentClass}`} onSubmit={(event) => void submit(event)} noValidate>
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden"><label>Website<input name="_website" tabIndex={-1} autoComplete="off" /></label></div>
    {title && <h2 className="text-2xl font-semibold">{title}</h2>}
    {form.definition.steps.length > 1 && <p className="text-sm text-ink/55" aria-live="polite">Step {step + 1} of {form.definition.steps.length}</p>}
    {currentStep?.title && form.definition.steps.length > 1 && <h3 className="text-xl font-semibold">{currentStep.title}</h3>}
    {currentStep?.description && <p className="text-sm text-ink/65">{currentStep.description}</p>}
    <div className="grid grid-cols-12 gap-4 text-left">        {currentStep?.fields.map((field) => <div key={`${field.id}-${fileInputKey}`} style={{ gridColumn: `span ${Math.min(12, Math.max(1, Number(field.settings?.columnSpan) || 12))}` }}><Field field={field} value={values[field.name]} error={errors[field.name]} errors={errors} setValue={setValue} values={values} isAuthenticated={isAuthenticated} onNext={() => { if (validateStep()) setStep((value) => value + 1); }} onPrevious={() => setStep((value) => Math.max(0, value - 1))} onCancel={resetForm} /></div>)}</div>
    {message && status === "ready" && <p role="alert" className="text-sm text-red-700">{message}</p>}
    {!hasButtonFields && <div className="flex flex-wrap items-center justify-between gap-3">
      <div>{currentStep && step > 0 && <button type="button" className="focus-ring rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold" onClick={() => setStep((value) => value - 1)}>Back</button>}</div>
      <div className="flex flex-wrap gap-3">
        {form.definition.steps.length > 1 && step < form.definition.steps.length - 1 ? <button type="button" className="focus-ring rounded-full bg-[rgb(var(--color-coral))] px-5 py-2.5 text-sm font-semibold text-white" onClick={() => { if (validateStep()) setStep((value) => value + 1); }}>Next</button> : <button type="submit" disabled={status === "loading"} className="focus-ring rounded-full bg-[rgb(var(--color-coral))] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{form.definition.submitLabel}</button>}
      </div>
    </div>}
  </form>;
}

function Field({ field, value, error, errors = {}, setValue, values, isAuthenticated = false, onNext, onPrevious, onCancel }: { field: FormField; value: unknown; error?: string; errors?: Record<string, string>; setValue: (name: string, value: unknown) => void; values: Record<string, unknown>; isAuthenticated?: boolean; onNext?: () => void; onPrevious?: () => void; onCancel?: () => void }) {
  const [remoteRows, setRemoteRows] = useState<{ parent: string; child: string; grandchild: string }[]>([]);
  useEffect(() => {
    const url = field.type === "chained-select" && field.settings?.sourceMode === "remote" && typeof field.settings.remoteUrl === "string" ? field.settings.remoteUrl : "";
    if (!url) { setRemoteRows([]); return; }
    let active = true;
    void fetch(url).then((response) => response.text()).then((text) => {
      const rows = text.trim().split(/\r?\n/).slice(1).map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))).filter((cells) => cells.length >= 2 && cells[0] && cells[1]).map((cells) => ({ parent: cells[0], child: cells[1], grandchild: cells[2] ?? "" }));
      if (active) setRemoteRows(rows);
    }).catch(() => { if (active) setRemoteRows([]); });
    return () => { active = false; };
  }, [field.type, field.settings?.remoteUrl, field.settings?.sourceMode]);
  if (!formFieldConditionsMatch(field, values)) return null;
  if (field.type === "section-break") {
    const items = layoutItems(field);
    if (field.settings?.layout === "accordion") return <div className="grid gap-2">{items.map((item) => <details key={item.id} className="rounded-lg border border-ink/15 bg-white"><summary className="cursor-pointer px-4 py-3 font-semibold">{item.title}</summary><div className="grid gap-4 border-t border-ink/10 p-4">{item.fields.map((nested) => <Field key={nested.id} field={nested} value={values[nested.name]} error={errors[nested.name]} errors={errors} setValue={setValue} values={values} />)}</div></details>)}</div>;
    if (field.settings?.layout === "tabs") return <TabsLayout items={items} values={values} errors={errors} setValue={setValue} />;
    if (field.settings?.layout === "columns") {
      const columns = Number(field.settings.columns) || 1;
      const widths = Array.isArray(field.settings.columnWidths) && field.settings.columnWidths.length === columns ? field.settings.columnWidths : Array.from({ length: columns }, () => 1);
      const columnFields = Array.isArray(field.settings.columnFields) ? field.settings.columnFields as unknown[] : [];
      return <div className="grid gap-4" style={{ gridTemplateColumns: widths.map((width) => `${Number(width) || 1}fr`).join(" ") }}>{Array.from({ length: columns }, (_, index) => { const nested = Array.isArray(columnFields[index]) ? columnFields[index] as FormField[] : []; return <div key={index} className="grid content-start gap-4">{nested.map((child) => <Field key={child.id} field={child} value={values[child.name]} error={errors[child.name]} errors={errors} setValue={setValue} values={values} />)}</div>; })}</div>;
    }

    return <div className={`rich-text-content border-t border-ink/15 pt-4 ${typeof field.settings?.elementClass === "string" ? field.settings.elementClass : ""}`}><h4 className="font-semibold">{field.label}</h4>{field.settings?.html ? <div dangerouslySetInnerHTML={{ __html: sanitizeFormHtml(replaceSmartCodes(field.settings.html, values)) }} /> : field.description && <p className="mt-1 text-sm text-ink/60">{field.description}</p>}</div>;
  }
  if (field.type === "custom-html") return <div className={`rich-text-content ${typeof field.settings?.containerClass === "string" ? field.settings.containerClass : ""}`} dangerouslySetInnerHTML={{ __html: sanitizeFormHtml(replaceSmartCodes(field.settings?.html, values)) }} />;
  if (field.type === "name" || field.type === "address") return <GroupField field={field} value={value} errors={errors} setValue={setValue} />;
  if (field.type === "button") {
    const settings = field.settings ?? {};
    if (settings.loggedInOnly === true && !isAuthenticated) return null;
    const buttonType = String(settings.buttonType ?? "submit");
    const buttonSize = String(settings.buttonSize ?? "medium");
    const buttonStyle = String(settings.buttonStyle ?? "coral");
    const buttonAlignment = String(settings.buttonAlignment ?? "left");
    const buttonText = String(settings.buttonText ?? field.label);
    const sizeClass = buttonSize === "small" ? "px-3 py-2 text-sm" : buttonSize === "large" ? "px-6 py-3.5 text-base" : "px-5 py-2.5 text-sm";
    const styleClass = buttonStyle === "outline" ? "border border-[rgb(var(--color-coral))] text-[rgb(var(--color-coral))]" : buttonStyle === "ink" ? "bg-[rgb(var(--color-ink))] text-white" : buttonStyle === "success" ? "bg-green-700 text-white" : buttonStyle === "muted" ? "bg-mist text-ink" : "bg-[rgb(var(--color-coral))] text-white";
    const alignmentClass = buttonAlignment === "center" ? "justify-center" : buttonAlignment === "right" ? "justify-end" : "justify-start";
    const widthClass = buttonAlignment === "full" ? "w-full justify-center" : "";
    const buttonClass = `focus-ring inline-flex ${widthClass} ${sizeClass} rounded-full font-semibold ${styleClass}`;
    if (buttonType === "other") {
      const action = String(settings.action ?? "url");
      if (action === "email") return <div className={`flex ${alignmentClass}`}><a href={`mailto:${String(settings.email ?? "")}`} className={buttonClass}>{buttonText}</a></div>;
      if (action === "download") return <div className={`flex ${alignmentClass}`}><a href={String(settings.downloadUrl ?? "#")} download className={buttonClass}>{buttonText}</a></div>;
      return <div className={`flex ${alignmentClass}`}><a href={String(settings.url ?? "#")} target={settings.target === "_blank" ? "_blank" : undefined} rel={settings.target === "_blank" ? "noreferrer" : undefined} className={buttonClass}>{buttonText}</a></div>;
    }
    const type = buttonType === "submit" ? "submit" : "button";
    const onClick = buttonType === "next" ? onNext : buttonType === "previous" ? onPrevious : buttonType === "cancel" ? onCancel : undefined;
    return <div className={`flex ${alignmentClass}`}><button type={type} className={buttonClass} onClick={onClick}>{buttonText}</button></div>;
  }
  const inputId = `form-${field.id}`;
  const describedBy = error ? `${inputId}-error` : field.description ? `${inputId}-description` : undefined;
  const settings = field.settings ?? {};
  const fieldName = typeof settings.nameAttribute === "string" && settings.nameAttribute ? settings.nameAttribute : field.name;
  const fieldValue = value === undefined ? settings.defaultValue ?? "" : value;
  const labelPlacement = typeof settings.labelPlacement === "string" ? settings.labelPlacement : "top";
  const label = <label htmlFor={inputId} className={`font-semibold text-ink ${labelPlacement === "hide" ? "sr-only" : ""}`}>{field.label}{field.required && <span aria-hidden="true" className="ml-1 text-coral">*</span>}</label>;
  const helpText = typeof settings.helpMessage === "string" && settings.helpMessage ? settings.helpMessage : field.description;
  const help = helpText && <p id={`${inputId}-description`} className="text-sm text-ink/55">{helpText}</p>;
  const invalid = error ? { "aria-invalid": true, "aria-describedby": describedBy } : { "aria-describedby": describedBy };
  const common = `focus-ring rounded-lg border border-ink/20 bg-white px-3 py-2.5 text-ink ${typeof settings.elementClass === "string" ? settings.elementClass : ""}`;
  const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue(field.name, event.target.value);
  let control: React.ReactNode;
  if (field.type === "textarea") control = <textarea id={inputId} name={fieldName} rows={typeof settings.rows === "number" ? settings.rows : 4} cols={typeof settings.columns === "number" ? settings.columns : undefined} placeholder={field.placeholder} value={String(fieldValue)} onChange={onChange} className={common} maxLength={typeof settings.maxLength === "number" ? settings.maxLength : undefined} {...invalid} />;
  else if (field.type === "chained-select") {
    const levels = Array.isArray(settings.levels) && settings.levels.length === 3 ? settings.levels.map(String) : ["Parent", "Child", "Grandchild"];
    const selected = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const rows = remoteRows.length ? remoteRows : Array.isArray(settings.chainRows) ? settings.chainRows.filter((row): row is { parent: string; child: string; grandchild: string } => Boolean(row && typeof row === "object" && typeof (row as { parent?: unknown }).parent === "string")) : [];
    const parentOptions = uniqueOptions(rows.map((row) => row.parent));
    const childOptions = uniqueOptions(rows.filter((row) => row.parent === selected.parent).map((row) => row.child));
    const grandchildOptions = uniqueOptions(rows.filter((row) => row.parent === selected.parent && row.child === selected.child).map((row) => row.grandchild));
    const choose = (key: "parent" | "child" | "grandchild", next: string) => setValue(field.name, key === "parent" ? { parent: next, child: "", grandchild: "" } : key === "child" ? { ...selected, child: next, grandchild: "" } : { ...selected, grandchild: next });
    control = <div className="grid gap-2">{[["parent", parentOptions], ["child", childOptions], ["grandchild", grandchildOptions]].map(([key, options], index) => <select key={String(key)} id={index === 0 ? inputId : undefined} name={index === 0 ? fieldName : `${fieldName}_${String(key)}`} value={String(selected[String(key)] ?? "")} onChange={(event) => choose(key as "parent" | "child" | "grandchild", event.target.value)} className={common} {...(index === 0 ? invalid : {})}><option value="">{levels[index]}</option>{(options as string[]).map((option) => <option key={option} value={option}>{option}</option>)}</select>)}</div>;
  } else if (field.type === "select") {
    const options = choiceOptions(field);
    const groups = field.type === "select" && settings.optionGrouping === true && Array.isArray(settings.optionGroups) ? settings.optionGroups.filter((group): group is { label: string; options: { value: string; label: string }[] } => Boolean(group && typeof group === "object" && typeof (group as { label?: unknown }).label === "string" && Array.isArray((group as { options?: unknown }).options))) : [];
    control = <select id={inputId} name={fieldName} value={String(fieldValue)} onChange={onChange} className={common} {...invalid}><option value="">{field.placeholder || "Choose…"}</option>{groups.length ? groups.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>) : options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  } else if (field.type === "radio") {
    const options = choiceOptions(field);
    control = <div className="grid gap-2" role="radiogroup" aria-labelledby={inputId}>{options.map((option) => <label key={option.value} className="flex items-center gap-2 font-normal"><input type="radio" name={fieldName} value={option.value} checked={value === option.value} onChange={onChange} {...invalid} />{option.label}</label>)}{settings.allowOther === true && <><label className="flex items-center gap-2 font-normal"><input type="radio" name={fieldName} value="__other" checked={value === "__other"} onChange={onChange} />Other</label>{value === "__other" && <input className={common} name={`${fieldName}_other`} placeholder="Enter your answer" value={String(values[`${field.name}_other`] ?? "")} onChange={(event) => setValue(`${field.name}_other`, event.target.value)} />}</>}</div>;
  }
  else if (field.type === "terms") {
    control = <TermsAgreement field={field} value={value} setValue={setValue} inputId={inputId} fieldName={fieldName} invalid={invalid} />;
  } else if (field.type === "checkbox") {
    if (!(field.options?.length)) control = <label className="flex items-start gap-2 font-normal"><input id={inputId} type="checkbox" name={fieldName} checked={value === true} onChange={(event) => setValue(field.name, event.target.checked)} className="mt-1" {...invalid} /><span>{field.label}</span></label>;
    else {
      const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      const options = choiceOptions(field);
      control = <div className="grid gap-2" role="group" aria-labelledby={inputId}>{options.map((option) => <label key={option.value} className="flex items-center gap-2 font-normal"><input type="checkbox" name={fieldName} value={option.value} checked={selected.includes(option.value)} onChange={(event) => setValue(field.name, event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} {...invalid} />{option.label}</label>)}{settings.allowOther === true && <><label className="flex items-center gap-2 font-normal"><input type="checkbox" checked={selected.includes("__other")} onChange={(event) => setValue(field.name, event.target.checked ? [...selected, "__other"] : selected.filter((item) => item !== "__other"))} />Other</label>{selected.includes("__other") && <input className={common} name={`${fieldName}_other`} placeholder="Enter your answer" value={String(values[`${field.name}_other`] ?? "")} onChange={(event) => setValue(`${field.name}_other`, event.target.value)} />}</>}</div>;
    }
  }
  else if (field.type === "ranking") control = <Ranking field={field} value={value} setValue={setValue} />;
  else if (field.type === "file") {
    const maxFiles = typeof settings.maxFiles === "number" && settings.maxFiles > 1 ? Math.floor(settings.maxFiles) : 1;
    const selectedFiles = Array.isArray(value) ? value : value ? [value] : [];
    const fileInput = <input id={inputId} type="file" name={fieldName} multiple={maxFiles > 1} accept={fileAccept(settings.allowedFiles)} onChange={(event) => { const files = Array.from(event.target.files ?? []).slice(0, maxFiles); setValue(field.name, files.length > 1 ? files : files[0] ?? ""); }} className={settings.uploadInterface === "dropzone" ? "sr-only" : common} {...invalid} />;
    const fileSummary = selectedFiles.length ? <p className="text-sm text-ink/60">{selectedFiles.map((file) => typeof file === "object" && file ? String((file as { name?: unknown }).name ?? "Selected file") : "Selected file").join(", ")}</p> : <p className="text-sm text-ink/50">Drop {maxFiles > 1 ? "files" : "a file"} here or choose {maxFiles > 1 ? "them" : "one"}.</p>;
    control = settings.uploadInterface === "dropzone"
      ? <label htmlFor={inputId} className="grid cursor-pointer gap-2 rounded-xl border-2 border-dashed border-coral/50 bg-coral/5 p-6 text-center hover:bg-coral/10" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const files = Array.from(event.dataTransfer.files).slice(0, maxFiles); setValue(field.name, files.length > 1 ? files : files[0] ?? ""); }}><span className="font-semibold">{String(settings.buttonText ?? "Choose file")}</span>{fileSummary}{fileInput}</label>
      : <div className="grid gap-2">{fileInput}<label htmlFor={inputId} className="focus-ring inline-flex w-fit cursor-pointer rounded-lg border border-ink/20 bg-white px-3 py-2.5 text-sm font-semibold">{String(settings.buttonText ?? "Choose file")}</label>{fileSummary}</div>;
  }
  else if (field.type === "phone") {
    const rawPhone = String(fieldValue);
    const digits = rawPhone.replace(/\D/g, "");
    const localDigits = rawPhone.trim().startsWith("+1") ? digits.slice(1) : digits;
    control = <div className="flex items-stretch"><span className="flex items-center rounded-l-lg border border-r-0 border-ink/20 bg-mist/50 px-3 text-sm font-semibold text-ink/65">+1</span><input id={inputId} name={fieldName} type="tel" inputMode="tel" autoComplete="tel" placeholder={field.placeholder} value={localDigits} onChange={(event) => setValue(field.name, `+1${event.target.value.replace(/\D/g, "").slice(0, 10)}`)} className={`${common} min-w-0 flex-1 rounded-l-none`} {...invalid} /></div>;
  } else if (field.type === "date") {
    const dateFormat = typeof settings.dateFormat === "string" ? settings.dateFormat : "m/d/Y";
    control = <input id={inputId} name={fieldName} type={dateFormat.includes("i") || dateFormat.includes("h") ? "datetime-local" : "date"} placeholder={field.placeholder || dateFormat} value={String(fieldValue)} onChange={onChange} className={common} {...invalid} />;
  } else if (field.type === "masked") {
    const mask = maskPattern(settings);
    const inputMode = settings.mobileKeyboardType === "decimal" || settings.mobileKeyboardType === "tel" ? settings.mobileKeyboardType : "numeric";
    control = <input id={inputId} name={fieldName} type="text" inputMode={inputMode} placeholder={field.placeholder || mask} value={String(fieldValue)} onChange={(event) => setValue(field.name, applyMask(event.target.value, mask, settings.reverseMask === true))} onBlur={() => { if (settings.clearOnMismatch !== false && fieldValue && !maskMatches(String(fieldValue), mask)) setValue(field.name, ""); }} className={common} {...invalid} />;
  } else control = <input id={inputId} name={fieldName} type={field.type} placeholder={field.placeholder} value={String(fieldValue)} onChange={onChange} className={common} maxLength={typeof settings.maxLength === "number" ? settings.maxLength : undefined} {...invalid} />;
  const labelFirst = labelPlacement !== "bottom" && labelPlacement !== "right";
  const labelNode = labelPlacement === "hide" ? null : label;
  return <div className={`${typeof settings.containerClass === "string" ? settings.containerClass : ""} grid gap-1.5 ${labelPlacement === "right" || labelPlacement === "left" ? "grid-cols-[auto_1fr] items-center" : ""}`}>{labelFirst && labelNode}{labelPlacement === "left" && <span className="order-2">{control}</span>}{labelPlacement !== "left" && <>{typeof settings.prefixLabel === "string" && settings.prefixLabel && <span className="text-sm text-ink/60">{settings.prefixLabel}</span>}{labelPlacement === "right" && labelNode}{help}{control}{typeof settings.suffixLabel === "string" && settings.suffixLabel && <span className="text-sm text-ink/60">{settings.suffixLabel}</span>}</>}{!labelFirst && labelNode}{error && <p id={`${inputId}-error`} role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}

function TermsAgreement({ field, value, setValue, inputId, fieldName, invalid }: { field: FormField; value: unknown; setValue: (name: string, value: unknown) => void; inputId: string; fieldName: string; invalid: Record<string, boolean | string | undefined> }) {
 const settings = field.settings ?? {};
 const showCheckbox = settings.showCheckbox !== false;
 const includeTerms = settings.includeTerms !== false;
 const includePrivacy = settings.includePrivacy !== false;
 const termsHtml = typeof settings.termsHtml === "string" ? settings.termsHtml : "<h2>Terms and Conditions</h2><p>No terms have been published yet.</p>";
 const privacyHtml = typeof settings.privacyHtml === "string" ? settings.privacyHtml : "<h2>Privacy Policy</h2><p>No privacy policy has been published yet.</p>";
 const [open, setOpen] = useState<"terms" | "privacy" | null>(null);
 const [read, setRead] = useState({ terms: !includeTerms, privacy: !includePrivacy });
 const documentRef = useRef<HTMLDivElement>(null);
 const documentRead = read.terms && read.privacy;
 useEffect(() => {
   if (!open) return;
   const documentElement = documentRef.current;
   if (documentElement && documentElement.scrollHeight <= documentElement.clientHeight) setRead((current) => ({ ...current, [open]: true }));
 }, [open, termsHtml, privacyHtml]);
 const openDocument = (document: "terms" | "privacy") => {
   setRead((current) => ({ ...current, [document]: false }));
   setOpen(document);
 };
 const text = <span>I have read and agree to{includeTerms && <>{ " "}<button type="button" className="font-semibold text-coral underline" onClick={() => openDocument("terms")}>the Terms and Conditions</button></>}{includeTerms && includePrivacy && " and"}{includePrivacy && <>{ " "}<button type="button" className="font-semibold text-coral underline" onClick={() => openDocument("privacy")}>the Privacy Policy</button></>}{!includeTerms && !includePrivacy && " these terms"}.</span>;
 return <div className="grid gap-3">
   {showCheckbox ? <label className="flex items-start gap-2 font-normal"><input id={inputId} type="checkbox" name={fieldName} checked={value === true} disabled={!documentRead} onChange={(event) => setValue(field.name, event.target.checked)} className="mt-1 disabled:cursor-not-allowed disabled:opacity-50" {...invalid} />{text}</label> : text}
   {showCheckbox && !documentRead && <p className="text-xs text-ink/55">Open and read each linked document before checking the agreement.</p>}
   {open && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-${open}-title`}><div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><h2 id={`${inputId}-${open}-title`} className="font-serif text-2xl">{open === "terms" ? "Terms and Conditions" : "Privacy Policy"}</h2><button type="button" className="focus-ring rounded-full border border-ink/15 px-3 py-1.5 text-sm font-semibold" onClick={() => setOpen(null)}>Close</button></div><div ref={documentRef} className="min-h-0 overflow-y-auto px-5 py-5 leading-7 text-ink/75" onScroll={(event) => { const target = event.currentTarget; if (target.scrollTop + target.clientHeight >= target.scrollHeight - 4) setRead((current) => ({ ...current, [open]: true })); }} dangerouslySetInnerHTML={{ __html: sanitizeFormHtml(open === "terms" ? termsHtml : privacyHtml) }} /><div className="border-t border-ink/10 px-5 py-4"><p className="text-xs text-ink/55">{read[open] ? "You have reached the end of this document." : "Scroll to the end of this document to continue."}</p><button type="button" className="focus-ring mt-2 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!read[open]} onClick={() => setOpen(null)}>Continue</button></div></div></div>}
 </div>;
}

function layoutItems(field: FormField) {
  const raw = field.settings?.items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is { id: string; title: string; fields: FormField[] } => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof (item as { title?: unknown }).title === "string")).map((item) => ({ ...item, fields: Array.isArray(item.fields) ? item.fields : [] }));
}

function TabsLayout({ items, values, errors, setValue }: { items: { id: string; title: string; fields: FormField[] }[]; values: Record<string, unknown>; errors: Record<string, string>; setValue: (name: string, value: unknown) => void }) {
  const [active, setActive] = useState(0);
  const item = items[active] ?? items[0];
  if (!item) return null;
  return <div className="rounded-lg border border-ink/15 bg-white"><div className="flex gap-1 overflow-x-auto border-b border-ink/10 px-2 pt-2">{items.map((tab, index) => <button key={tab.id} type="button" onClick={() => setActive(index)} className={`rounded-t px-3 py-2 text-sm font-semibold ${index === active ? "border border-b-0 border-ink/15" : "text-ink/45"}`}>{tab.title}</button>)}</div><div className="grid gap-4 p-4">{item.fields.map((field) => <Field key={field.id} field={field} value={values[field.name]} error={errors[field.name]} errors={errors} setValue={setValue} values={values} />)}</div></div>;
}

function GroupField({ field, value, errors, setValue }: { field: FormField; value: unknown; errors: Record<string, string>; setValue: (name: string, value: unknown) => void }) {
  const settings = field.settings ?? {};
  const groupValue = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const configs = settings.fields && typeof settings.fields === "object" && !Array.isArray(settings.fields) ? settings.fields as Record<string, Record<string, unknown>> : {};
  const order = Array.isArray(settings.order) ? settings.order.filter((item): item is string => typeof item === "string") : Object.keys(configs);
  const updateChild = (name: string, next: string) => setValue(field.name, { ...groupValue, [name]: next });
  return <div className={`grid gap-3 ${typeof settings.containerClass === "string" ? settings.containerClass : ""}`}>{order.map((name) => {
    const config = configs[name] ?? {};
    if (config.enabled === false) return null;
    const inputId = `form-${field.id}-${name}`;
    const labelPlacement = typeof config.labelPlacement === "string" ? config.labelPlacement : "top";
    const error = errors[`${field.name}.${name}`];
    const common = `focus-ring rounded-lg border border-ink/20 bg-white px-3 py-2.5 text-ink ${typeof settings.elementClass === "string" ? settings.elementClass : ""}`;
    const options = name === "state" ? usStateOptions() : name === "country" ? countryOptions() : [];
    const childValue = String(groupValue[name] ?? config.defaultValue ?? "");
    const control = options.length ? <select id={inputId} value={childValue} onChange={(event) => updateChild(name, event.target.value)} className={common} aria-invalid={Boolean(error)}><option value="">{String(config.placeholder ?? "Choose…")}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={inputId} type="text" value={childValue} placeholder={String(config.placeholder ?? "")} onChange={(event) => updateChild(name, event.target.value)} className={common} aria-invalid={Boolean(error)} />;
    const label = <label htmlFor={inputId} className={`font-semibold ${labelPlacement === "hide" ? "sr-only" : ""}`}>{String(config.label ?? name)}{config.required === true && <span aria-hidden="true" className="ml-1 text-coral">*</span>}</label>;
    return <div key={name} className={`${labelPlacement === "right" || labelPlacement === "left" ? "grid grid-cols-[auto_1fr] items-center gap-2" : "grid gap-1.5"}`}>{labelPlacement !== "right" && label}{labelPlacement === "right" && label}{control}{typeof config.helpMessage === "string" && config.helpMessage && <p className="text-sm text-ink/55">{config.helpMessage}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
  })}</div>;
}

function Ranking({ field, value, setValue }: { field: FormField; value: unknown; setValue: (name: string, value: unknown) => void }) {
  const settings = field.settings ?? {};
  const baseOptions = field.options ?? [];
  const options = settings.shuffled === true ? choiceOptions(field) : baseOptions;
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : options.map((option) => option.value);
  const move = (index: number, direction: -1 | 1) => { const next = [...selected]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setValue(field.name, next); };
  return <div className="grid gap-2"><ol className="grid gap-2">{selected.map((item, index) => { const option = options.find((candidate) => candidate.value === item); return <li key={item} className="flex items-center gap-3 rounded border border-ink/15 bg-white px-3 py-2"><span className="w-5 text-sm font-semibold text-ink/50">{settings.showPosition !== false ? index + 1 : ""}</span>{settings.photos === true && option?.photo && <img src={option.photo} alt="" className="h-10 w-10 rounded object-cover" /> }<span className="flex-1">{option?.label ?? item}{settings.showValues === true && <span className="ml-2 text-xs text-ink/45">({option?.value ?? item})</span>}</span><span className="flex gap-1"><button type="button" aria-label="Move up" className="focus-ring px-2" onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Move down" className="focus-ring px-2" onClick={() => move(index, 1)}>↓</button></span></li>; })}</ol>{settings.showReset !== false && <button type="button" className="focus-ring justify-self-start text-sm font-semibold text-coral underline" onClick={() => setValue(field.name, options.map((option) => option.value))}>↺ Reset order</button>}</div>;
}

function chainedOptions(field: FormField, values: Record<string, unknown>) {
  const chains = field.settings?.chains;
  if (!chains || typeof chains !== "object" || Array.isArray(chains)) return field.options ?? [];
  const parent = typeof field.settings?.parentField === "string" ? field.settings.parentField : "";
  const value = parent ? values[parent] : "";
  const options = (chains as Record<string, unknown>)[String(value)];
  return Array.isArray(options) ? options.map((item, index) => typeof item === "object" && item && "value" in item && "label" in item ? item as { value: string; label: string } : { value: String(item), label: String(item) || `Option ${index + 1}` }) : field.options ?? [];
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function replaceSmartCodes(value: unknown, values: Record<string, unknown>) {
  if (typeof value !== "string") return "";
  return value.replace(/\{([A-Za-z][A-Za-z0-9_-]*)\}/g, (_match, name: string) => {
    const replacement = values[name];
    return Array.isArray(replacement) ? replacement.join(", ") : replacement && typeof replacement === "object" ? Object.values(replacement as Record<string, unknown>).join(" / ") : String(replacement ?? "");
  });
}

function choiceOptions(field: FormField) {
  const options = field.options ?? [];
  if (field.settings?.shuffled !== true) return options;
  return [...options].sort((a, b) => `${field.id}:${a.value}`.localeCompare(`${field.id}:${b.value}`));
}

function fileAccept(value: unknown) {
  const groups: Record<string, string> = {
    images: "image/*", audio: "audio/*", video: "video/*", pdf: "application/pdf",
    docs: ".doc,.docx,.txt,.rtf", zip: ".zip,.rar,.7z,.gz", executable: ".exe,.msi,.app,.bin", csv: ".csv"
  };
  return Array.isArray(value) ? value.map((item) => groups[String(item)]).filter(Boolean).join(",") : "";
}

function maskPattern(settings: Record<string, unknown>) {
  if (settings.maskType === "custom") return typeof settings.customMask === "string" ? settings.customMask : "";
  return ({ phone: "(000) 000-0000", date: "00/00/0000", time: "00:00", datetime: "00/00/0000 00:00", ssn: "000-00-0000" } as Record<string, string>)[String(settings.maskType ?? "phone")] ?? "(000) 000-0000";
}

function applyMask(value: string, mask: string, reverse: boolean) {
  const tokens = value.split("").filter((character) => /[0-9A-Za-z]/.test(character));
  if (reverse) tokens.reverse();
  let index = 0;
  const output: string[] = [];
  for (const character of mask.split("")) {
    if (character !== "0" && character !== "A" && character !== "*") { output.push(character); continue; }
    const next = tokens[index];
    if (!next) break;
    if ((character === "0" && !/[0-9]/.test(next)) || (character === "A" && !/[A-Za-z]/.test(next))) { index++; continue; }
    output.push(next); index++;
  }
  return output.join("").slice(0, mask.length || undefined);
}

function maskMatches(value: string, mask: string) {
  if (!mask || value.length !== mask.length) return false;
  return mask.split("").every((character, index) => character === "0" ? /[0-9]/.test(value[index]) : character === "A" ? /[A-Za-z]/.test(value[index]) : character === "*" ? /[A-Za-z0-9]/.test(value[index]) : value[index] === character);
}
