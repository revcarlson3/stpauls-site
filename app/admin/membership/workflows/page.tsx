"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui";

type Workflow = { id: string; name: string; description: string | null; targetType: string; steps: { type: string; field?: string; operation?: string; value?: string; reason?: string }[] };
type Step = { type: string; field: string; operation: string; value: string; reason: string };
type WorkflowTarget = { id: string; targetType: "INDIVIDUAL" | "FAMILY"; label: string; detail: string };
type WorkflowRun = { workflow: Workflow; stepIndex: number; note: string; status: "running" | "complete" };

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DECEASED", label: "Deceased" }
];
const FIELD_OPTIONS: Record<string, { value: string; label: string; choices?: { value: string; label: string }[] }[]> = {
  INDIVIDUAL: [
    { value: "firstName", label: "First name" }, { value: "middleName", label: "Middle name" }, { value: "lastName", label: "Last name" },
    { value: "email", label: "Email" }, { value: "cellphone", label: "Cell phone" }, { value: "otherPhone", label: "Other phone" },
    { value: "otherPhoneType", label: "Other phone type" }, { value: "gradeLevel", label: "Grade level" },
    { value: "maritalStatus", label: "Marital status", choices: [{ value: "Single", label: "Single" }, { value: "Married", label: "Married" }, { value: "Divorced", label: "Divorced" }, { value: "Separated", label: "Separated" }, { value: "Widowed", label: "Widowed" }, { value: "Unspecified", label: "Unspecified" }] }, { value: "ageCategoryOverride", label: "Age category" },
    { value: "envelopeNumber", label: "Envelope number" }, { value: "relationshipNotes", label: "Relationship notes" },
    { value: "communicationNotes", label: "Communication notes" }, { value: "emailMessagesAllowed", label: "Email messages allowed", choices: [{ value: "true", label: "Allowed" }, { value: "false", label: "Not allowed" }] }, { value: "smsMessagesAllowed", label: "SMS messages allowed", choices: [{ value: "true", label: "Allowed" }, { value: "false", label: "Not allowed" }] }, { value: "preferredContactMethod", label: "Preferred contact method", choices: [{ value: "NO_PREFERENCE", label: "No preference" }, { value: "EMAIL", label: "Email" }, { value: "PHONE", label: "Phone" }, { value: "SMS", label: "SMS" }] }, { value: "doNotContact", label: "Do not contact", choices: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }
  ],
  FAMILY: [
    { value: "lastName", label: "Family last name" }, { value: "email", label: "Email" }, { value: "phone", label: "Phone" },
    { value: "addressStreet", label: "Street address" }, { value: "addressCity", label: "City" }, { value: "addressState", label: "State" },
    { value: "addressZip", label: "ZIP code" }, { value: "secondaryStreet", label: "Secondary street address" }, { value: "secondaryCity", label: "Secondary city" }, { value: "secondaryState", label: "Secondary state" }, { value: "secondaryZip", label: "Secondary ZIP code" }, { value: "secondaryIsMailing", label: "Secondary address is mailing address", choices: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }, { value: "formalGreeting", label: "Formal greeting" }, { value: "informalGreeting", label: "Informal greeting" }
  ]
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState("INDIVIDUAL");
  const [steps, setSteps] = useState<Step[]>([{ type: "status", field: "", operation: "set", value: "DECEASED", reason: "" }]);
  const [targetQuery, setTargetQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<WorkflowTarget | null>(null);
  const [targetOptions, setTargetOptions] = useState<WorkflowTarget[]>([]);
  const [targetSearchPending, setTargetSearchPending] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [workflowRunMessage, setWorkflowRunMessage] = useState("");
  const [workflowRunPending, setWorkflowRunPending] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    void fetch("/api/membership/workflows").then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to load workflows.");
      setWorkflows(body.workflows ?? []);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load workflows."));
  }
  useEffect(load, []);
  useEffect(() => {
    const targetId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("targetId") ?? "";
    if (!targetId) return;
    setTargetSearchPending(true);
    void fetch(`/api/membership/workflow-targets?id=${encodeURIComponent(targetId)}`)
      .then((response) => response.json())
      .then((body) => {
        const target = body.targets?.[0] as WorkflowTarget | undefined;
        if (target) {
          setSelectedTarget(target);
          setTargetQuery(target.label);
        }
      })
      .finally(() => setTargetSearchPending(false));
  }, []);
  useEffect(() => {
    if (targetQuery.trim().length < 3 || selectedTarget?.label === targetQuery.trim()) {
      if (targetQuery.trim().length < 3) setTargetOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setTargetSearchPending(true);
      void fetch(`/api/membership/workflow-targets?search=${encodeURIComponent(targetQuery.trim())}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((body) => setTargetOptions(body.targets ?? []))
        .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setMessage("Unable to search directory."); })
        .finally(() => setTargetSearchPending(false));
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [targetQuery, selectedTarget]);

  async function saveWorkflow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(editingWorkflowId ? `/api/membership/workflows/${editingWorkflowId}` : "/api/membership/workflows", { method: editingWorkflowId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, targetType, steps }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to save workflow."); return; }
    setName(""); setDescription(""); setTargetType("INDIVIDUAL"); setSteps([{ type: "status", field: "", operation: "set", value: "DECEASED", reason: "" }]); setEditingWorkflowId(null); setMessage(editingWorkflowId ? "Workflow updated." : "Workflow saved."); load();
  }
  function updateStep(index: number, changes: Partial<Step>) {
    setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }
  function editWorkflow(workflow: Workflow) {
    setEditingWorkflowId(workflow.id);
    setName(workflow.name);
    setDescription(workflow.description ?? "");
    setTargetType(workflow.targetType);
    setSteps(workflow.steps.map((step) => ({ type: step.type, field: step.field ?? "", operation: step.operation ?? "set", value: step.value ?? "", reason: step.reason ?? "" })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function deleteWorkflow(workflow: Workflow) {
    if (!window.confirm(`Delete the "${workflow.name}" workflow?`)) return;
    const response = await fetch(`/api/membership/workflows/${workflow.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Workflow deleted." : body.error ?? "Unable to delete workflow.");
    if (response.ok) load();
  }
  function beginWorkflow(workflow: Workflow) {
    if (!selectedTarget) { setMessage("Search for and select an individual or family first."); return; }
    if (selectedTarget.targetType !== workflow.targetType) { setMessage(`This workflow applies to ${workflow.targetType.toLowerCase()}s. Select a matching directory record.`); return; }
    setWorkflowRun({ workflow, stepIndex: 0, note: "", status: "running" });
    setWorkflowRunMessage("");
  }
  async function approveWorkflowStep() {
    if (!workflowRun || !selectedTarget || workflowRun.status === "complete") return;
    const step = workflowRun.workflow.steps[workflowRun.stepIndex];
    if (step.type === "notePrompt" && !workflowRun.note.trim()) return;
    setWorkflowRunPending(true);
    const notes = step.type === "notePrompt" ? [{ reason: step.reason || "Workflow note", body: workflowRun.note.trim() }] : [];
    try {
      const response = await fetch(`/api/membership/workflows/${workflowRun.workflow.id}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: selectedTarget.id, stepIndex: workflowRun.stepIndex, notes }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWorkflowRunMessage(body.error ?? "Unable to run this workflow step.");
      } else if (workflowRun.stepIndex + 1 >= workflowRun.workflow.steps.length) {
        setWorkflowRun({ ...workflowRun, status: "complete" });
        setWorkflowRunMessage(`${workflowRun.workflow.name} completed successfully.`);
      } else {
        setWorkflowRun({ ...workflowRun, stepIndex: workflowRun.stepIndex + 1, note: "" });
        setWorkflowRunMessage("");
      }
    } catch {
      setWorkflowRunMessage("Unable to reach the workflow service. No step was approved.");
    } finally {
      setWorkflowRunPending(false);
    }
  }

  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="mt-2 font-serif text-4xl">Workflows</h1><p className="mt-3 max-w-2xl text-ink/60">Save repeatable transitions for common membership changes, then apply them consistently to an individual or family.</p></div><a href="/admin/membership" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Directory</a></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <form onSubmit={(event) => void saveWorkflow(event)} className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><h2 className="font-serif text-2xl">{editingWorkflowId ? "Edit workflow" : "Create workflow"}</h2><label className="grid gap-1 text-sm font-semibold">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="Member death" /></label><label className="grid gap-1 text-sm font-semibold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" rows={3} /></label><label className="grid gap-1 text-sm font-semibold">Applies to<select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="INDIVIDUAL">Individual</option><option value="FAMILY">Family</option></select></label>      <div className="grid gap-3"><p className="text-sm font-semibold">Actions</p>{steps.map((step, index) => <div key={index} className="grid gap-2 rounded-xl border border-ink/10 p-3">            <div className="flex gap-2"><select value={step.type} onChange={(event) => updateStep(index, { type: event.target.value, field: event.target.value === "field" ? FIELD_OPTIONS[targetType][0].value : "", operation: "set", value: event.target.value === "status" ? "ACTIVE" : event.target.value === "directoryListed" ? "true" : "" })} className="focus-ring min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"><option value="status">Set status</option>{targetType === "INDIVIDUAL" && <><option value="directoryListed">Directory visibility</option><option value="field">Change a field</option><option value="removePhotograph">Remove photograph</option><option value="notePrompt">Prompt for a note</option></>}</select>{steps.length > 1 && <button type="button" onClick={() => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="focus-ring rounded-lg px-2 text-sm font-semibold text-ink/60 hover:text-coral" aria-label={`Remove action ${index + 1}`}>Remove</button>}</div>{step.type === "field" && <>      <select value={step.field || FIELD_OPTIONS[targetType][0].value}       onChange={(event) => { const field = FIELD_OPTIONS[targetType].find((option) => option.value === event.target.value); updateStep(index, { field: event.target.value, value: field?.choices?.[0]?.value ?? "" }); }} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm">{FIELD_OPTIONS[targetType].map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}</select><select value={step.operation} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, operation: event.target.value } : item))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm"><option value="set">Set value</option><option value="clear">Delete contents</option><option value="append">Add to existing content</option></select></>}{step.type === "notePrompt" && <input value={step.reason} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm" placeholder="Prompt label, e.g. Pastoral follow-up note" />}      {step.type === "status" && <select value={step.value || "ACTIVE"} onChange={(event) => updateStep(index, { value: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm">{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>}{step.type === "directoryListed" && <select value={step.value || "true"} onChange={(event) => updateStep(index, { value: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm"><option value="true">Listed in directory</option><option value="false">Hidden from directory</option></select>}      {step.type === "field" && step.operation !== "clear" && (FIELD_OPTIONS[targetType].find((field) => field.value === step.field)?.choices ? <select value={step.value} onChange={(event) => updateStep(index, { value: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm">{FIELD_OPTIONS[targetType].find((field) => field.value === step.field)?.choices?.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : <input value={step.value} onChange={(event) => updateStep(index, { value: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm" placeholder="Enter the new value" />)}</div>)}<button type="button" onClick={() => setSteps((current) => [...current, { type: "status", field: "", operation: "set", value: "INACTIVE", reason: "" }])} className="focus-ring w-fit rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold">Add action</button></div><button className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Save workflow</button></form>
      <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><h2 className="font-serif text-2xl">Saved workflows</h2><div className="mt-4 grid gap-1 text-sm font-semibold"><label htmlFor="workflow-target">Directory target</label><input id="workflow-target" value={targetQuery} onChange={(event) => { setTargetQuery(event.target.value); setSelectedTarget(null); }} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="Search a first name, last name, or family name" autoComplete="off" /><span className="text-xs font-normal text-ink/55">{targetSearchPending ? "Searching directory…" : "Enter at least 3 characters, then select the individual or family to update."}</span>{targetOptions.length > 0 && <div className="overflow-hidden rounded-lg border border-ink/15 bg-white shadow-sm" role="listbox">{targetOptions.map((target) => <button type="button" key={`${target.targetType}-${target.id}`} onClick={() => { setSelectedTarget(target); setTargetQuery(target.label); setTargetOptions([]); }} className="focus-ring block w-full border-b border-ink/10 px-3 py-2 text-left last:border-b-0 hover:bg-cream"       role="option" aria-selected={selectedTarget?.id === target.id && selectedTarget.targetType === target.targetType}><span className="block font-semibold">{target.label}</span><span className="block text-xs font-normal text-ink/55">{target.targetType.toLowerCase()} · {target.detail}</span></button>)}</div>}{selectedTarget && <p className="text-xs font-normal text-ink/60">Selected: <span className="font-semibold text-ink">{selectedTarget.label}</span> ({selectedTarget.targetType.toLowerCase()})</p>}</div><div className="mt-5 grid gap-3">{workflows.map((workflow) => <article key={workflow.id} className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{workflow.name}</h3><p className="text-xs uppercase tracking-wide text-ink/50">{workflow.targetType.toLowerCase()} · {workflow.steps.length} action{workflow.steps.length === 1 ? "" : "s"}</p><p className="mt-2 text-sm text-ink/60">{workflow.description || "No description."}</p>      </div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editWorkflow(workflow)} className="focus-ring rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold">Edit</button><button type="button" onClick={() => void deleteWorkflow(workflow)} className="focus-ring rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold text-ink/60">Delete</button>      <button type="button" onClick={() => beginWorkflow(workflow)} disabled={!selectedTarget || selectedTarget.targetType !== workflow.targetType} className="focus-ring rounded-full border border-coral px-3 py-1 text-sm font-semibold text-coral disabled:cursor-not-allowed disabled:opacity-40">Apply</button></div></div></article>)}{!workflows.length && <p className="text-sm text-ink/60">No workflows saved yet.</p>}</div></section>
    </div>{message && <p role="status" className="mt-4 text-sm text-coral">{message}</p>}{workflowRun && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="workflow-run-title"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">Workflow step {workflowRun.status === "complete" ? workflowRun.workflow.steps.length : workflowRun.stepIndex + 1} of {workflowRun.workflow.steps.length}</p><h2 id="workflow-run-title" className="mt-2 font-serif text-2xl">{workflowRun.workflow.name}</h2></div>{workflowRun.status === "running" && <button type="button" onClick={() => setWorkflowRun(null)} className="focus-ring rounded-full border border-ink/20 px-3 py-1 text-sm font-semibold">Cancel</button>}</div>{workflowRun.status === "complete" ? <div className="mt-6 grid gap-4"><p className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800">{workflowRunMessage}</p><button type="button" onClick={() => setWorkflowRun(null)} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Complete</button></div> : <div className="mt-6 grid gap-4"><div className="rounded-xl border border-ink/10 bg-cream/40 p-4"><p className="text-sm font-semibold">{workflowRun.workflow.steps[workflowRun.stepIndex].type === "notePrompt" ? "Add a note" : workflowRun.workflow.steps[workflowRun.stepIndex].type === "field" ? `Change ${workflowRun.workflow.steps[workflowRun.stepIndex].field || "field"}`     : workflowRun.workflow.steps[workflowRun.stepIndex].type === "directoryListed" ? "Update directory visibility" : workflowRun.workflow.steps[workflowRun.stepIndex].type === "removePhotograph" ? "Remove photograph" : "Set status"}</p><p className="mt-2 text-sm text-ink/60">{workflowRun.workflow.steps[workflowRun.stepIndex].reason || workflowRun.workflow.steps[workflowRun.stepIndex].value || "This step will update the selected record."}</p>{workflowRun.workflow.steps[workflowRun.stepIndex].type === "notePrompt" && <textarea autoFocus value={workflowRun.note} onChange={(event) => setWorkflowRun({ ...workflowRun, note: event.target.value })} className="focus-ring mt-3 min-h-24 rounded-lg border border-ink/15 px-3 py-2 text-sm" placeholder="Enter the note before approving this step." />}</div>{workflowRunMessage && <p role="alert" className="text-sm text-coral">{workflowRunMessage}</p>}<button type="button" onClick={() => void approveWorkflowStep()} disabled={workflowRunPending || (workflowRun.workflow.steps[workflowRun.stepIndex].type === "notePrompt" && !workflowRun.note.trim())} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{workflowRunPending ? "Running…" : "Approve"}</button></div>}</div></div>}</Container></main>;
}
