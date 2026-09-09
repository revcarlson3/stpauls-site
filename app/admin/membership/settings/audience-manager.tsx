"use client";

import { useEffect, useMemo, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Notification } from "@/components/ui";

type Count = { members?: number; individuals?: number };
type Group = { id: string; name: string; description: string | null; position: number; leaderCount?: number; _count: Count };
type List = { id: string; name: string; description: string | null; _count: Count };
type Dynamic = { id: string; name: string; description: string | null; criteria: Criteria; count: number };
type Member = { id: string; firstName: string; lastName: string | null; familyLastName?: string };
type VolunteerDetail = { role: string; isLeader: boolean; availability: string; skills: string };
type Type = { id: string; name: string };
type Condition = { field: string; operator: string; value: string };
type Criteria = { conditions: Condition[]; match: "all" | "any" };
type CustomField = { id: string; name: string; type: string; options?: unknown };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const OPERATORS = [{ value: "equals", label: "equals" }, { value: "notEquals", label: "does not equal" }, { value: "contains", label: "contains" }, { value: "greaterOrEqual", label: "is at least" }, { value: "lessOrEqual", label: "is at most" }, { value: "isSet", label: "is set" }, { value: "isNotSet", label: "is not set" }, { value: "yearGreaterOrEqual", label: "year is at least" }, { value: "yearLessOrEqual", label: "year is at most" }];

function SortableGroup({ group, onEdit, onDelete }: { group: Group; onEdit: (group: Group) => void; onDelete: (group: Group) => void }) {
  const sortable = useSortable({ id: group.id });
  return <div ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 ${sortable.isDragging ? "bg-white shadow-lg" : ""}`}>
    <button type="button" {...sortable.attributes} {...sortable.listeners} className="focus-ring touch-none cursor-grab rounded-lg px-2 py-1 text-lg text-ink/40 active:cursor-grabbing" aria-label={`Drag ${group.name} to reorder`}>☰</button>
    <div className="min-w-0 flex-1"><p className="font-semibold">{group.name}</p><p className="text-xs text-ink/55">{group._count.members ?? 0} member{(group._count.members ?? 0) === 1 ? "" : "s"}</p></div>
    <button type="button" onClick={() => onEdit(group)} className="text-sm font-semibold text-coral">Rename</button>
    <button type="button" onClick={() => onDelete(group)} className="text-sm font-semibold text-coral">Delete</button>
  </div>;
}

const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";

function criteriaSummary(criteria: Criteria) {
  return criteria.conditions.map((condition) => {
    const field = condition.field.startsWith("custom:") ? "Custom field" : condition.field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
    const operator = condition.operator === "equals" ? "=" : condition.operator === "notEquals" ? "≠" : condition.operator === "contains" ? "contains" : condition.operator;
    return `${field} ${operator}${condition.value ? ` ${condition.value}` : ""}`;
  }).join(criteria.match === "any" ? " · ANY · " : " · ALL · ");
}

export function AudienceManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [dynamicLists, setDynamicLists] = useState<Dynamic[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [dynamicName, setDynamicName] = useState("");
  const [dynamicDescription, setDynamicDescription] = useState("");
  const [criteria, setCriteria] = useState<Criteria>({ conditions: [], match: "all" });
  const [editingDynamic, setEditingDynamic] = useState<string>("");
  const [selectedAudience, setSelectedAudience] = useState<{ kind: "group" | "list"; id: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState<"lastName" | "firstName" | "assignedAt">("lastName");
  const [assigned, setAssigned] = useState<string[]>([]);
  const [volunteerDetails, setVolunteerDetails] = useState<Record<string, VolunteerDetail>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    try {
      const responses = await Promise.all(["volunteer-groups", "manual-lists", "dynamic-lists"].map((path) => fetch(`/api/membership/${path}`)));
      const values = await Promise.all(responses.map((response) => response.json()));
      if (values.some((value, index) => !responses[index].ok)) throw new Error("Unable to load membership audiences.");
      setGroups(values[0].groups ?? []);
      setLists(values[1].lists ?? []);
      setDynamicLists(values[2].lists ?? []);
      const typeResponse = await fetch("/api/membership/member-types");
      const typeValue = await typeResponse.json();
      if (typeResponse.ok) setTypes((typeValue.types ?? []).map((type: Type) => ({ id: type.id, name: type.name })));
      const customResponse = await fetch("/api/membership/custom-fields?appliesTo=INDIVIDUAL&active=1");
      const customValue = await customResponse.json();
      if (customResponse.ok) setCustomFields(customValue.fields ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load membership audiences.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function createSimple(kind: "volunteer-groups" | "manual-lists") {
    const clean = (kind === "volunteer-groups" ? groupName : listName).trim();
    if (!clean) return;
    const response = await fetch(`/api/membership/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean, description: kind === "manual-lists" ? listDescription : groupDescription }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to create audience."); return; }
    if (kind === "volunteer-groups") { setGroupName(""); setGroupDescription(""); } else { setListName(""); setListDescription(""); }
    setMessage("Audience created."); await load();
  }

  async function renameSimple(kind: "volunteer-groups" | "manual-lists", item: Group | List) {
    const next = window.prompt("New name", item.name)?.trim();
    if (!next || next === item.name) return;
    const response = await fetch(`/api/membership/${kind}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, name: next, description: item.description ?? "" }) });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Unable to rename audience."); else { setMessage("Audience renamed."); await load(); }
  }

  async function duplicateSimple(kind: "volunteer-groups" | "manual-lists", item: Group | List) {
    const name = window.prompt("Name for the duplicate", `Copy of ${item.name}`)?.trim();
    if (!name) return;
    const response = await fetch(`/api/membership/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: item.description ?? "", copyOfId: item.id }) });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Unable to duplicate audience."); else { setMessage("Audience duplicated."); await load(); }
  }

  async function deleteSimple(kind: "volunteer-groups" | "manual-lists", item: Group | List) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    const response = await fetch(`/api/membership/${kind}?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Unable to delete audience."); else { setMessage("Audience deleted."); await load(); }
  }

  async function reorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const next = arrayMove(groups, groups.findIndex((group) => group.id === event.active.id), groups.findIndex((group) => group.id === event.over?.id)).map((group, position) => ({ ...group, position }));
    setGroups(next);
    const response = await fetch("/api/membership/volunteer-groups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((group) => group.id) }) });
    if (!response.ok) { setError("Unable to save volunteer group order."); await load(); }
  }

  async function openMembers(kind: "group" | "list", id: string) {
    setSelectedAudience({ kind, id });
    const response = await fetch(`/api/membership/${kind === "group" ? "volunteer-groups" : "manual-lists"}/${id}/members?sort=${memberSort}`);
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to load members."); return; }
    setAssigned((value.members ?? []).map((member: Member) => member.id));
    if (kind === "group") setVolunteerDetails(Object.fromEntries((value.members ?? []).map((member: Member & { role?: string | null; isLeader?: boolean; availability?: { notes?: string } | null; skills?: string | null }) => [member.id, { role: member.role ?? "", isLeader: member.isLeader === true, availability: member.availability?.notes ?? "", skills: member.skills ?? "" }])));
    await searchMembers("");
  }

  async function reloadAssignedMembers(sort = memberSort) {
    if (!selectedAudience) return;
    const response = await fetch(`/api/membership/${selectedAudience.kind === "group" ? "volunteer-groups" : "manual-lists"}/${selectedAudience.id}/members?sort=${sort}`);
    const value = await response.json();
    if (response.ok) setAssigned((value.members ?? []).map((member: Member) => member.id));
  }

  async function searchMembers(search: string) {
    setMemberSearch(search);
    const response = await fetch(`/api/membership?status=active${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    const value = await response.json();
    if (response.ok) setMembers(value.members ?? []);
  }

  async function saveMembers() {
    if (!selectedAudience) return;
    const path = selectedAudience.kind === "group" ? "volunteer-groups" : "manual-lists";
    const response = await fetch(`/api/membership/${path}/${selectedAudience.id}/members`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selectedAudience.kind === "group" ? { members: assigned.map((individualId) => ({ individualId, ...(volunteerDetails[individualId] ? { ...volunteerDetails[individualId], availability: volunteerDetails[individualId].availability ? { notes: volunteerDetails[individualId].availability } : null } : {}) })) } : { memberIds: assigned }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to save members."); return; }
    setMessage(`${value.count} member${value.count === 1 ? "" : "s"} assigned.`); setSelectedAudience(null); await load();
  }

  async function saveDynamic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dynamicName.trim()) { setError("Enter a dynamic list name."); return; }
    if (!criteria.conditions.length || criteria.conditions.some((condition) => !condition.field || (!condition.value && !["isSet", "isNotSet"].includes(condition.operator)))) { setError("Add at least one complete query condition."); return; }
    const response = await fetch("/api/membership/dynamic-lists", { method: editingDynamic ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingDynamic || undefined, name: dynamicName, description: dynamicDescription, criteria }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to save dynamic list."); return; }
    setDynamicName(""); setDynamicDescription(""); setCriteria({ conditions: [], match: "all" }); setEditingDynamic(""); setMessage("Dynamic list saved."); await load();
  }

  async function deleteDynamic(list: Dynamic) {
    if (!window.confirm(`Delete "${list.name}"?`)) return;
    const response = await fetch(`/api/membership/dynamic-lists?id=${encodeURIComponent(list.id)}`, { method: "DELETE" });
    if (!response.ok) { const value = await response.json(); setError(value.error ?? "Unable to delete dynamic list."); return; }
    await load();
  }

  const visibleMembers = useMemo(() => [...members].sort((a, b) => {
    if (memberSort === "firstName") return a.firstName.localeCompare(b.firstName);
    if (memberSort === "assignedAt") return 0;
    return (a.lastName ?? a.familyLastName ?? "").localeCompare(b.lastName ?? b.familyLastName ?? "") || a.firstName.localeCompare(b.firstName);
  }).slice(0, 100), [members, memberSort]);
  return <div id="audiences" className="mt-8 grid gap-6 xl:grid-cols-2">
    {message && <Notification variant="success" className="xl:col-span-2">{message}</Notification>}
    {error && <Notification variant="danger" className="xl:col-span-2">{error}</Notification>}
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Volunteer groups</h2><p className="mt-2 text-sm text-ink/60">Create reusable volunteer audiences, order them, and manage their members.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} className={`${inputClass} min-w-0`} placeholder="Group name" maxLength={100} /><input value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} className={inputClass} placeholder="Description (optional)" maxLength={500} /><Button type="button" onClick={() => void createSimple("volunteer-groups")}>Add</Button></div>
      <div className="mt-4 grid gap-2"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorder(event)}><SortableContext items={groups.map((group) => group.id)} strategy={verticalListSortingStrategy}>{groups.map((group) => <div key={group.id}><SortableGroup group={group} onEdit={(item) => void renameSimple("volunteer-groups", item)} onDelete={(item) => void deleteSimple("volunteer-groups", item)} /><p className="ml-10 text-xs text-ink/55">{group.description || "No description"} · {group.leaderCount ?? 0} leader{(group.leaderCount ?? 0) === 1 ? "" : "s"}</p><div className="ml-10 mt-1 flex flex-wrap gap-3"><button type="button" onClick={() => void openMembers("group", group.id)} className="text-xs font-semibold text-coral">Manage volunteers</button><button type="button" onClick={() => void duplicateSimple("volunteer-groups", group)} className="text-xs font-semibold text-coral">Duplicate</button><a href={`/admin/membership/messaging?target=volunteer-group&audienceId=${encodeURIComponent(group.id)}`} className="text-xs font-semibold text-coral">Message group</a></div></div>)}</SortableContext></DndContext>{!groups.length && <p className="text-sm text-ink/55">No volunteer groups yet.</p>}</div>
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Manual lists</h2><p className="mt-2 text-sm text-ink/60">Maintain named lists of members for recurring communications and ministry work.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input value={listName} onChange={(event) => setListName(event.target.value)} className={`${inputClass} min-w-0`} placeholder="List name" maxLength={100} /><input value={listDescription} onChange={(event) => setListDescription(event.target.value)} className={inputClass} placeholder="Description (optional)" maxLength={500} /><Button type="button" onClick={() => void createSimple("manual-lists")}>Add</Button></div>
      <div className="mt-4 grid gap-2">{lists.map((list) => <div key={list.id} className="rounded-xl border border-ink/10 p-3"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="font-semibold">{list.name}</p><p className="text-xs text-ink/55">{list.description || "No description"} · {list._count.members ?? 0} member{(list._count.members ?? 0) === 1 ? "" : "s"}</p></div><button type="button" onClick={() => void renameSimple("manual-lists", list)} className="text-sm font-semibold text-coral">Rename</button><button type="button" onClick={() => void duplicateSimple("manual-lists", list)} className="text-sm font-semibold text-coral">Duplicate</button><button type="button" onClick={() => void deleteSimple("manual-lists", list)} className="text-sm font-semibold text-coral">Delete</button></div><button type="button" onClick={() => void openMembers("list", list.id)} className="mt-1 text-xs font-semibold text-coral">Manage members</button></div>)}{!lists.length && <p className="text-sm text-ink/55">No manual lists yet.</p>}</div>
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm xl:col-span-2">
      <h2 className="font-serif text-2xl">Dynamic lists</h2><p className="mt-2 text-sm text-ink/60">Build a reusable query from one or more conditions. Each row is evaluated against current member records.</p>
      <form onSubmit={(event) => void saveDynamic(event)} className="mt-4">
        <div className="grid gap-2 rounded-xl border border-ink/10 p-3">
          {criteria.conditions.map((condition, index) => <div key={`${index}-${condition.field}`} className="grid gap-2 md:grid-cols-[1.2fr_1fr_1.2fr_auto]">
            <select value={condition.field} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, field: event.target.value, operator: "equals", value: "" } : row) })} className={inputClass} aria-label="Query field">
              <option value="">Choose field...</option><option value="status">Member Status</option><option value="memberType">Member Type</option><option value="emailConsent">Email Consent</option><option value="smsConsent">SMS Consent</option><option value="city">City</option><option value="firstName">First Name</option><option value="lastName">Last Name</option><option value="email">Email</option><option value="birthdayMonth">Birthday Month</option><option value="birthdayYear">Birth Year</option><option value="weddingMonth">Wedding Month</option><option value="weddingYear">Wedding Year</option><option value="weddingDate">Wedding Date</option><option value="deceasedYear">Deceased Year</option><option value="deceasedDate">Deceased Date</option><option value="volunteerGroup">Volunteer Group</option>{customFields.map((field) => <option key={field.id} value={`custom:${field.id}`}>{field.name}{field.type === "DATE" ? " (date)" : ""}</option>)}
            </select>
            <select value={condition.operator} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, operator: event.target.value } : row) })} className={inputClass} aria-label="Query operator">
              {OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}<option value="monthGreaterOrEqual">month is at least</option><option value="monthLessOrEqual">month is at most</option>
            </select>
            {condition.operator === "isSet" || condition.operator === "isNotSet" ? <span className={`${inputClass} text-ink/55`}>No value needed</span>
              : condition.field === "status" ? <select value={condition.value} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={inputClass} aria-label="Query value"><option value="">Choose status...</option>{["ACTIVE", "INACTIVE", "DECEASED", "REMOVED"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
              : condition.field === "memberType" ? <select value={condition.value} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={inputClass} aria-label="Query value"><option value="">Choose type...</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
              : condition.field === "volunteerGroup" ? <select value={condition.value} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={inputClass} aria-label="Query value"><option value="">Choose group...</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
              : condition.field === "emailConsent" || condition.field === "smsConsent" ? <select value={condition.value} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={inputClass} aria-label="Query value"><option value="">Choose...</option><option value="true">Allowed</option><option value="false">Not allowed</option></select>
              : condition.field.endsWith("Month") || customFields.some((field) => `custom:${field.id}` === condition.field && field.type === "DATE") ? <select value={condition.value} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={inputClass} aria-label="Query value"><option value="">Choose month...</option>{MONTHS.map((month, monthIndex) => <option key={month} value={String(monthIndex + 1)}>{month}</option>)}</select>
              : <input type={condition.field.endsWith("Year") || condition.operator.startsWith("year") ? "number" : "text"} value={condition.value} onChange={(event) => setCriteria({ ...criteria, conditions: criteria.conditions.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={inputClass} placeholder="Value" aria-label="Query value" />}
            <button type="button" onClick={() => setCriteria({ ...criteria, conditions: criteria.conditions.filter((_, rowIndex) => rowIndex !== index) })} className="focus-ring rounded-lg px-2 text-sm font-semibold text-coral">Remove</button>
          </div>)}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setCriteria({ ...criteria, conditions: [...criteria.conditions, { field: "", operator: "equals", value: "" }] })} className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Add condition</button>
            {criteria.conditions.length > 1 && <label className="text-sm font-semibold">Match <select value={criteria.match} onChange={(event) => setCriteria({ ...criteria, match: event.target.value as "all" | "any" })} className={`${inputClass} ml-2`}><option value="all">all conditions</option><option value="any">any condition</option></select></label>}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-sm font-semibold">List name<input required value={dynamicName} onChange={(event) => setDynamicName(event.target.value)} className={inputClass} placeholder="e.g. February birthdays" /></label><label className="grid gap-1 text-sm font-semibold">Description<input value={dynamicDescription} onChange={(event) => setDynamicDescription(event.target.value)} className={inputClass} placeholder="What is this query for?" maxLength={500} /></label><Button type="submit" className="self-end whitespace-nowrap px-4 py-2">{editingDynamic ? "Update list" : "Save list"}</Button>{editingDynamic && <button type="button" onClick={() => { setEditingDynamic(""); setDynamicName(""); setDynamicDescription(""); setCriteria({ conditions: [], match: "all" }); }} className="self-end whitespace-nowrap text-sm font-semibold text-coral">Cancel</button>}</div>
      </form>
      <div className="mt-5 grid gap-2 md:grid-cols-2">{dynamicLists.map((list) => <div key={list.id} className="flex items-center gap-3 rounded-xl border border-ink/10 p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{list.name}</p><p className="text-xs text-ink/55">{list.description || "No description"} · {criteriaSummary(list.criteria)} · {list.count} matching member{list.count === 1 ? "" : "s"}</p></div><a href={`/admin/membership?dynamicListId=${encodeURIComponent(list.id)}`} className="text-sm font-semibold text-coral">View members</a><button type="button" onClick={() => { setEditingDynamic(list.id); setDynamicName(list.name); setDynamicDescription(list.description ?? ""); setCriteria({ conditions: list.criteria.conditions ?? [], match: list.criteria.match ?? "all" }); }} className="text-sm font-semibold text-coral">Edit</button><button type="button" onClick={() => void fetch("/api/membership/dynamic-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Copy of ${list.name}`, description: list.description ?? "", criteria: list.criteria }) }).then(() => load())} className="text-sm font-semibold text-coral">Duplicate</button><button type="button" onClick={() => void deleteDynamic(list)} className="text-sm font-semibold text-coral">Delete</button></div>)}</div>
    </section>
    {selectedAudience && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"><div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Assign members</h2><button type="button" onClick={() => setSelectedAudience(null)} className="text-ink/60">Close</button></div><div className="mt-4 flex gap-2"><input value={memberSearch} onChange={(event) => void searchMembers(event.target.value)} className={`${inputClass} min-w-0 flex-1`} placeholder="Search members" /><select value={memberSort} onChange={(event) => { const sort = event.target.value as typeof memberSort; setMemberSort(sort); void reloadAssignedMembers(sort); }} className={inputClass} aria-label="Sort assigned members"><option value="lastName">Last name</option><option value="firstName">First name</option><option value="assignedAt">Recently assigned</option></select></div><p className="mt-2 text-xs text-ink/55">Sorting changes the visible assignment order; it does not change membership.</p>    <div className="mt-4 grid max-h-96 gap-2 overflow-auto">{visibleMembers.map((member) => <label key={member.id} className="flex items-center gap-3 rounded-lg border border-ink/10 p-3"><input type="checkbox" checked={assigned.includes(member.id)} onChange={(event) => { setAssigned((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id)); if (event.target.checked && selectedAudience.kind === "group" && !volunteerDetails[member.id]) setVolunteerDetails((current) => ({ ...current, [member.id]: { role: "", isLeader: false, availability: "", skills: "" } })); }} /><span>{member.firstName} {member.lastName ?? member.familyLastName ?? ""}</span></label>)}</div>{selectedAudience.kind === "group" && <div className="mt-4 grid gap-3 border-t border-ink/10 pt-4"><h3 className="font-semibold">Volunteer details</h3>{visibleMembers.filter((member) => assigned.includes(member.id)).map((member) => { const detail = volunteerDetails[member.id] ?? { role: "", isLeader: false, availability: "", skills: "" }; return <div key={member.id} className="grid gap-2 rounded-lg bg-mist/40 p-3 sm:grid-cols-2"><p className="font-semibold sm:col-span-2">{member.firstName} {member.lastName ?? member.familyLastName ?? ""}</p><input value={detail.role} onChange={(event) => setVolunteerDetails((current) => ({ ...current, [member.id]: { ...detail, role: event.target.value } }))} className={inputClass} placeholder="Role in group" /><input value={detail.skills} onChange={(event) => setVolunteerDetails((current) => ({ ...current, [member.id]: { ...detail, skills: event.target.value } }))} className={inputClass} placeholder="Skills" /><input value={detail.availability} onChange={(event) => setVolunteerDetails((current) => ({ ...current, [member.id]: { ...detail, availability: event.target.value } }))} className={`${inputClass} sm:col-span-2`} placeholder="Availability (days, times, notes)" /><label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={detail.isLeader} onChange={(event) => setVolunteerDetails((current) => ({ ...current, [member.id]: { ...detail, isLeader: event.target.checked } }))} /> Group leader</label></div>; })}</div>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelectedAudience(null)} className="rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold">Cancel</button><Button type="button" onClick={() => void saveMembers()}>Save members</Button></div></div></div>}
  </div>;
}
