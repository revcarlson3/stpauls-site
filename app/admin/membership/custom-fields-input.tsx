"use client";

import { useEffect, useState } from "react";

export type CustomFieldValueMap = Record<string, string>;

type Field = {
  id: string;
  name: string;
  type: "TEXT" | "TEXTAREA" | "SELECT" | "RADIO" | "CHECKBOX" | "DATE" | "PHONE" | "EMAIL";
  options: unknown;
  isRequired: boolean;
};

type Props = {
  appliesTo: "FAMILY" | "INDIVIDUAL";
  values: CustomFieldValueMap;
  onChange: (values: CustomFieldValueMap) => void;
};

const inputClass = "focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal";

function dateInputValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (match) {
    const year = match[3].length === 2 ? (Number(match[3]) >= 30 ? 1900 + Number(match[3]) : 2000 + Number(match[3])) : Number(match[3]);
    const month = value.includes("/") ? match[1] : match[2];
    const day = value.includes("/") ? match[2] : match[1];
    const candidate = `${year.toString().padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${candidate}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : "";
  }
  const named = value.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2}|\d{4})$/);
  if (!named) return "";
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
  const year = named[3].length === 2 ? (Number(named[3]) >= 30 ? 1900 + Number(named[3]) : 2000 + Number(named[3])) : Number(named[3]);
  const candidate = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  const date = new Date(`${candidate}T00:00:00.000Z`);
  return month > 0 && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : "";
}

export default function CustomFieldsInput({ appliesTo, values, onChange }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/membership/custom-fields?appliesTo=${appliesTo}&active=1`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load custom fields.");
        setFields(body.fields ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [appliesTo]);

  function setValue(id: string, value: string) {
    onChange({ ...values, [id]: value });
  }

  if (error) return <p role="alert" className="text-sm text-coral">{error}</p>;
  if (!fields.length) return null;

  return <fieldset className="grid gap-4 border-t border-ink/10 pt-5">
    <legend className="font-serif text-2xl">Additional information</legend>
    {fields.map((field) => {
      const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : [];
      const value = field.type === "DATE" ? dateInputValue(values[field.id] ?? "") : values[field.id] ?? "";
      const label = <>{field.name}{field.isRequired ? " *" : ""}</>;
      if (field.type === "TEXTAREA") return <label key={field.id} className="grid gap-1 text-sm font-semibold">{label}<textarea required={field.isRequired} value={value} onChange={(event) => setValue(field.id, event.target.value)} className={`${inputClass} min-h-24`} /></label>;
      if (field.type === "SELECT") return <label key={field.id} className="grid gap-1 text-sm font-semibold">{label}<select required={field.isRequired} value={value} onChange={(event) => setValue(field.id, event.target.value)} className={inputClass}><option value="">Choose an option</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
      if (field.type === "RADIO") return <div key={field.id} className="grid gap-2 text-sm font-semibold"><span>{label}</span>{options.map((option) => <label key={option} className="flex items-center gap-2 font-normal"><input type="radio" name={`custom-field-${field.id}`} required={field.isRequired} checked={value === option} onChange={() => setValue(field.id, option)} />{option}</label>)}</div>;
      if (field.type === "CHECKBOX") return <label key={field.id} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={value === "true"} required={field.isRequired} onChange={(event) => setValue(field.id, event.target.checked ? "true" : "false")} />{label}</label>;
      const type = field.type === "PHONE" ? "tel" : field.type === "EMAIL" ? "email" : field.type === "DATE" ? "date" : "text";
      return <label key={field.id} className="grid gap-1 text-sm font-semibold">{label}<input type={type} required={field.isRequired} value={value} onChange={(event) => setValue(field.id, event.target.value)} className={inputClass} /></label>;
    })}
  </fieldset>;
}
