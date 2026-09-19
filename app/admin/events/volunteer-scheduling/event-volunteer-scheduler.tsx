"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Group = { id: string; name: string };
type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; allDay: boolean; location: string | null; recurrenceGroupId: string | null; volunteerGroups: { groupId: string; group: Group }[] };
type AssignedGroup = { id: string; name: string; members: { id: string; name: string }[] };
type RotationOrder = { id: string; name: string; groupId: string; nextPosition: number; batchSize: number; notifyEmail: boolean; notifySms: boolean; notifyDayBefore: boolean; notificationLeadDays: number; entries: { id: string; individualId: string; position: number; individual: { id: string; firstName: string; lastName: string | null } }[] };
type EventAssignment = { id: string; groupId: string; rotationOrderId: string | null; scheduledIndividualId: string | null; source: "ROTATION" | "OVERRIDE" | string; group: { name: string }; individual: { id: string; firstName: string; lastName: string | null } };

function orderEntriesToSlots(entries: RotationOrder["entries"]) {
  return [...entries]
    .sort((a, b) => a.position - b.position)
    .map((entry) => ({ key: entry.id, individualId: entry.individualId, name: `${entry.individual.lastName ?? ""}, ${entry.individual.firstName}`.trim() }));
}

function SortableVolunteer({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><button type="button" {...attributes} {...listeners} className="focus-ring touch-none cursor-grab rounded-md px-2 py-1 text-ink/40 active:cursor-grabbing" aria-label={`Drag ${name} to reorder`}>☰</button><span>{name}</span></span><button type="button" aria-label={`Remove ${name} from this rotation`} onClick={(event) => { event.stopPropagation(); onRemove(); }} className="focus-ring rounded-md px-2 py-1 text-xs font-semibold text-coral hover:bg-coral/10">Remove</button></li>;
}

export function EventVolunteerScheduler() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [assignedGroups, setAssignedGroups] = useState<AssignedGroup[]>([]);
  const [rotationGroups, setRotationGroups] = useState<AssignedGroup[]>([]);
  const [orders, setOrders] = useState<RotationOrder[]>([]);
  const [rotationGroupId, setRotationGroupId] = useState("");
  const [rotationOrderId, setRotationOrderId] = useState("");
  const [orderName, setOrderName] = useState("");
  const [orderSlots, setOrderSlots] = useState<{ key: string; individualId: string; name: string }[]>([]);
  const [newSlotVolunteerId, setNewSlotVolunteerId] = useState("");
  const [batchSize, setBatchSize] = useState(1);
  const [notificationLeadDays, setNotificationLeadDays] = useState(7);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyDayBefore, setNotifyDayBefore] = useState(false);
  const [eventAssignments, setEventAssignments] = useState<EventAssignment[]>([]);
  const [overrideAssignment, setOverrideAssignment] = useState<EventAssignment | null>(null);
  const orderSlotsRef = useRef<{ key: string; individualId: string; name: string }[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    orderSlotsRef.current = orderSlots;
  }, [orderSlots]);

  useEffect(() => {
    void Promise.all([fetch(`/api/events/upcoming?page=${page}`).then((response) => response.json()), fetch("/api/membership/volunteer-groups").then((response) => response.json()), fetch("/api/volunteer-rotations").then((response) => response.json())]).then(([eventValue, groupValue, orderValue]) => {
      if (eventValue.error || groupValue.error || orderValue.error) throw new Error(eventValue.error ?? groupValue.error ?? orderValue.error);
      setEvents(eventValue.events ?? []);
      setPages(eventValue.pages ?? 1);
      setGroups((groupValue.groups ?? []).map((group: { id: string; name: string }) => ({ id: group.id, name: group.name })));
      void Promise.all((groupValue.groups ?? []).map(async (group: { id: string; name: string }) => {
        const response = await fetch(`/api/membership/volunteer-groups/${group.id}/members`);
        const value = await response.json();
        return { id: group.id, name: group.name, members: (value.members ?? []).map((member: { id: string; firstName: string; lastName: string | null; family?: { lastName: string } }) => ({ id: member.id, name: `${member.lastName ?? member.family?.lastName ?? ""}, ${member.firstName}`.trim() })) };
      })).then(setRotationGroups);
      setSelected(Object.fromEntries((eventValue.events ?? []).map((event: EventItem) => [event.id, event.volunteerGroups.map((link) => link.groupId)])));
      setOrders(orderValue.orders ?? []);
      if (!eventValue.events?.some((event: EventItem) => event.id === selectedEventId)) {
        setSelectedEventId(eventValue.events?.[0]?.id ?? "");
      }
    }).catch((reason: Error) => setError(reason.message));
  }, [page, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) { setAssignedGroups([]); return; }
    void Promise.all([fetch(`/api/events/${selectedEventId}/volunteers`), fetch(`/api/events/${selectedEventId}/rotation`)]).then(async ([volunteerResponse, rotationResponse]) => {
      const value = await volunteerResponse.json();
      const rotationValue = await rotationResponse.json();
      if (!volunteerResponse.ok || !rotationResponse.ok) throw new Error(value.error ?? rotationValue.error ?? "Unable to load event volunteers.");
      setAssignedGroups(value.groups ?? []);
      setEventAssignments(rotationValue.assignments ?? []);
    }).catch((reason: Error) => setError(reason.message));
  }, [selectedEventId]);

  useEffect(() => {
    if (!assignedGroups.length || !rotationGroups.length) {
      setRotationGroupId("");
      setRotationOrderId("");
      setOrderSlots([]);
      return;
    }
    const selectedGroupId = assignedGroups.some((group) => group.id === rotationGroupId) ? rotationGroupId : assignedGroups[0].id;
    const group = rotationGroups.find((entry) => entry.id === selectedGroupId);
    if (!group) return;
    const matching = orders.find((order) => order.groupId === group.id);
    setRotationGroupId(group.id);
    if (matching) {
      setRotationOrderId(matching.id);
      setOrderName(matching.name);
      setOrderSlots(orderEntriesToSlots(matching.entries));
      setBatchSize(matching.batchSize);
      setNotificationLeadDays(matching.notificationLeadDays);
      setNotifyEmail(matching.notifyEmail);
      setNotifySms(matching.notifySms);
      setNotifyDayBefore(matching.notifyDayBefore);
    } else {
      setRotationOrderId("");
      setOrderName(`${group.name} rotation`);
      setOrderSlots(group.members.map((member, index) => ({ key: `new-${member.id}-${index}`, individualId: member.id, name: member.name })));
      setBatchSize(1);
      setNotificationLeadDays(7);
      setNotifyEmail(true);
      setNotifySms(true);
      setNotifyDayBefore(false);
    }
  }, [assignedGroups, rotationGroups, orders, rotationGroupId]);

  function toggle(eventId: string, groupId: string) {
    setSelected((current) => {
      const values = current[eventId] ?? [];
      return { ...current, [eventId]: values.includes(groupId) ? values.filter((id) => id !== groupId) : [...values, groupId] };
    });
  }

  async function save(eventId: string) {
    setMessage(""); setError("");
    const response = await fetch(`/api/events/${eventId}/volunteer-groups`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupIds: selected[eventId] ?? [] }) });
    const value = await response.json();
    if (!response.ok) setError(value.error ?? "Unable to save volunteer groups."); else setMessage("Volunteer groups saved.");
  }

  async function saveForSeries(eventId: string) {
    setMessage(""); setError("");
    const response = await fetch(`/api/events/${eventId}/volunteer-groups`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupIds: selected[eventId] ?? [], applyToSeries: true }) });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to enable volunteer groups for the series.");
      return;
    }
    const source = events.find((event) => event.id === eventId);
    if (source?.recurrenceGroupId) {
      setSelected((current) => Object.fromEntries(Object.entries(current).map(([id, groupIds]) => events.find((event) => event.id === id)?.recurrenceGroupId === source.recurrenceGroupId ? [id, [...(current[eventId] ?? [])]] : [id, groupIds])));
    }
    setMessage("Volunteer groups enabled for all events in the series.");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = orderSlots.findIndex((slot) => slot.key === String(active.id));
    const to = orderSlots.findIndex((slot) => slot.key === String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(orderSlots, from, to);
    orderSlotsRef.current = next;
    setOrderSlots(next);
  }

  function addVolunteerSlot() {
    if (!newSlotVolunteerId) return;
    const member = rotationGroups.find((group) => group.id === rotationGroupId)?.members.find((entry) => entry.id === newSlotVolunteerId);
    if (!member) return;
    setOrderSlots((current) => [...current, { key: `new-${newSlotVolunteerId}-${Date.now()}`, individualId: newSlotVolunteerId, name: member.name }]);
    setNewSlotVolunteerId("");
  }

  async function saveRotationOrder() {
    setMessage(""); setError("");
    const selectedGroup = rotationGroups.find((group) => group.id === rotationGroupId);
    const existingOrder = orders.find((order) => order.id === rotationOrderId);
    const currentSlots = orderSlotsRef.current;
    const slots = currentSlots.length
      ? currentSlots
      : existingOrder ? orderEntriesToSlots(existingOrder.entries)
        : (selectedGroup?.members ?? []).map((member, index) => ({ key: `new-${member.id}-${index}`, individualId: member.id, name: member.name }));
    if (!slots.length) {
      setError("This volunteer group has no members available for rotation.");
      return;
    }
    if (!currentSlots.length) {
      orderSlotsRef.current = slots;
      setOrderSlots(slots);
    }
    const payload = { groupId: rotationGroupId, name: orderName, individualIds: slots.map((slot) => slot.individualId), batchSize, notificationLeadDays, notifyEmail, notifySms, notifyDayBefore };
    const response = await fetch(rotationOrderId ? `/api/volunteer-rotations/${rotationOrderId}` : "/api/volunteer-rotations", { method: rotationOrderId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const value = await response.json();
    if (!response.ok || !value.order) { setError(value.error ?? "Unable to save the rotation order."); return; }
    const savedOrder = value.order as RotationOrder;
    setRotationOrderId(savedOrder.id);
    const savedSlots = orderEntriesToSlots(savedOrder.entries);
    orderSlotsRef.current = savedSlots;
    setOrderSlots(savedSlots);
    setOrders((current) => rotationOrderId ? current.map((order) => order.id === savedOrder.id ? savedOrder : order) : [...current, savedOrder]);
    await refreshSelectedEvent();
    setMessage("Rotation order saved.");
  }

  async function applyRotationToEvent(eventId: string, orderId: string) {
    const response = await fetch(`/api/events/${eventId}/rotation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: rotationGroupId, orderId }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to apply the rotation."); return false; }
    return true;
  }

  async function refreshSelectedEvent() {
    if (!selectedEventId) return;
    const [volunteers, assignments] = await Promise.all([
      fetch(`/api/events/${selectedEventId}/volunteers`).then((result) => result.json()),
      fetch(`/api/events/${selectedEventId}/rotation`).then((result) => result.json())
    ]);
    setAssignedGroups(volunteers.groups ?? []);
    setEventAssignments(assignments.assignments ?? []);
  }

  async function applyRotation(orderId = rotationOrderId) {
    if (!selectedEventId || !rotationGroupId || !orderId) return;
    if (!await applyRotationToEvent(selectedEventId, orderId)) return;
    setMessage("Rotation applied to the selected event.");
    await refreshSelectedEvent();
  }

  async function applyRotationToLinkedEvents() {
    if (!rotationOrderId) return;
    setMessage(""); setError("");
    const response = await fetch(`/api/volunteer-rotations/${rotationOrderId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applyToLinkedEvents: true }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to apply the rotation to linked events."); return; }
    setMessage(`Rotation applied to ${value.appliedEventCount ?? 0} linked upcoming event${value.appliedEventCount === 1 ? "" : "s"}.`);
    await refreshSelectedEvent();
  }

  async function moveBackOneBatch() {
    if (!rotationOrderId) return;
    setMessage(""); setError("");
    const response = await fetch(`/api/volunteer-rotations/${rotationOrderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moveBackOneBatch: true, reassignEvents: true }) });
    const value = await response.json();
    if (!response.ok || !value.order) { setError(value.error ?? "Unable to move the rotation back one batch."); return; }
    setOrders((current) => current.map((order) => order.id === value.order.id ? value.order : order));
    await refreshSelectedEvent();
    setMessage(`Rotation moved back one batch and reassigned ${value.reassignedEventCount ?? 0} event${value.reassignedEventCount === 1 ? "" : "s"}.${value.skippedOverrideEventCount ? ` ${value.skippedOverrideEventCount} event${value.skippedOverrideEventCount === 1 ? "" : "s"} with overrides were left unchanged.` : ""}`);
  }

  async function deleteRotationOrder() {
    if (!rotationOrderId) return;
    const response = await fetch(`/api/volunteer-rotations/${rotationOrderId}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to delete the rotation order."); return; }
    setOrders((current) => current.filter((order) => order.id !== rotationOrderId));
    setRotationOrderId("");
    setMessage("Rotation order deleted.");
  }

  async function saveEventOverride(replacementIndividualId: string) {
    const orderId = overrideAssignment?.rotationOrderId;
    if (!selectedEventId || !overrideAssignment || !orderId) {
      setError("This assignment is not linked to an active rotation order.");
      return;
    }
    const response = await fetch(`/api/events/${selectedEventId}/rotation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: overrideAssignment.groupId, orderId, overrideAssignmentId: overrideAssignment.id, replacementIndividualId }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to save the event override."); return; }
    setMessage("Event override saved.");
    setOverrideAssignment(null);
    const assignments = await fetch(`/api/events/${selectedEventId}/rotation`).then((result) => result.json());
    setEventAssignments(assignments.assignments ?? []);
  }

  const assignedByGroup = Array.from(new Map(eventAssignments.map((assignment) => [assignment.groupId, { name: assignment.group.name, members: eventAssignments.filter((entry) => entry.groupId === assignment.groupId).map((entry) => entry.individual) }])).values());

  return <div className="mt-8 grid gap-5">
    {message && <p className="rounded-lg bg-teal/10 px-4 py-3 text-sm font-semibold text-teal-900">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-12">
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm xl:col-span-4">
        <h2 className="font-serif text-2xl">Upcoming events</h2>
        <p className="mt-1 text-sm text-ink/60">Select an event to view its volunteer rotation.</p>
        <div className="mt-4 grid gap-3">{events.length ? events.map((event) => <div key={event.id} className={`rounded-xl border p-3 ${selectedEventId === event.id ? "border-coral bg-coral/[.06]" : "border-ink/10"}`}>
          <button type="button" onClick={() => setSelectedEventId(event.id)} className="focus-ring w-full rounded-lg text-left">
            <p className="text-xs font-semibold text-coral">{new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            <p className="mt-1 font-semibold">{event.title}</p>
            <p className="mt-1 text-xs text-ink/55">{event.allDay ? "All day" : new Date(event.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
          </button>
          <details className="mt-3 border-t border-ink/10 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-ink/70">Link volunteer groups</summary>
            <div className="mt-2 grid gap-2">
              {groups.map((group) => <label key={group.id} className="flex items-center gap-2 text-xs text-ink/70"><input type="checkbox" checked={(selected[event.id] ?? []).includes(group.id)} onChange={() => toggle(event.id, group.id)} />{group.name}</label>)}
              <button type="button" onClick={() => void save(event.id)} className="focus-ring mt-1 w-full rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink/90">Save groups</button>
              {event.recurrenceGroupId && <button type="button" onClick={() => void saveForSeries(event.id)} className="focus-ring w-full rounded-lg border border-coral px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/[.06]">{(selected[event.id] ?? []).length ? "Update all events in series" : "Enable for all events in series"}</button>}
            </div>
          </details>
        </div>) : <p className="rounded-xl border border-dashed border-ink/20 p-5 text-sm text-ink/60">No upcoming events.</p>}</div>
        {pages > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page === 1} type="button" onClick={() => setPage((current) => current - 1)} className="focus-ring rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="text-xs text-ink/60">Page {page} of {pages}</span><button disabled={page === pages} type="button" onClick={() => setPage((current) => current + 1)} className="focus-ring rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>}
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm xl:col-span-4">
        <h2 className="font-serif text-2xl">Assigned volunteers</h2>
        <p className="mt-1 text-sm text-ink/60">Volunteers assigned to this event by its rotation orders.</p>
        <div className="mt-4 grid gap-4">{assignedByGroup.length ? assignedByGroup.map((group) => <div key={group.name}><h3 className="font-semibold">{group.name}</h3><ul className="mt-2 grid gap-1 text-sm text-ink/70">{group.members.map((member) => { const assignment = eventAssignments.find((entry) => entry.individual.id === member.id && entry.group.name === group.name); const replaced = assignment?.source === "OVERRIDE" && assignment.scheduledIndividualId !== null; const manual = assignment?.source === "OVERRIDE" && assignment.scheduledIndividualId === null; return <li key={member.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${replaced || manual ? "bg-coral/15 ring-1 ring-coral/25" : "bg-mist/50"}`}><span>{member.lastName ?? ""}, {member.firstName}</span>{assignment && <button type="button" onClick={() => setOverrideAssignment(assignment)} className={`focus-ring rounded-md px-2 py-1 text-xs font-semibold ${replaced || manual ? "bg-coral text-white" : "border border-coral text-coral"}`}>{manual ? "Manual" : replaced ? "Replaced" : "Override"}</button>}</li>; })}</ul></div>) : <p className="rounded-xl border border-dashed border-ink/20 p-5 text-sm text-ink/60">{selectedEventId ? "No volunteers have been assigned to this event." : "Select an event to view its volunteers."}</p>}</div>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm xl:col-span-4">
        <h2 className="font-serif text-2xl">Scheduling and Rotation</h2>
        <p className="mt-1 text-sm text-ink/60">Build a reusable order, then apply the next batch to the selected event.</p>
        {assignedGroups.length ? <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">Volunteer group
            <select value={rotationGroupId} onChange={(event) => { const id = event.target.value; const group = rotationGroups.find((entry) => entry.id === id); const order = orders.find((entry) => entry.groupId === id); setRotationGroupId(id); if (group && order) { setRotationOrderId(order.id); setOrderName(order.name); setOrderSlots(orderEntriesToSlots(order.entries)); setBatchSize(order.batchSize); setNotificationLeadDays(order.notificationLeadDays); setNotifyEmail(order.notifyEmail); setNotifySms(order.notifySms); setNotifyDayBefore(order.notifyDayBefore); } else if (group) { setRotationOrderId(""); setOrderName(`${group.name} rotation`); setOrderSlots(group.members.map((member, index) => ({ key: `new-${member.id}-${index}`, individualId: member.id, name: member.name }))); setBatchSize(1); setNotificationLeadDays(7); setNotifyEmail(true); setNotifySms(true); setNotifyDayBefore(false); } }} className="rounded-lg border border-ink/20 bg-white px-3 py-2 font-normal">
              {assignedGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Rotation order
            <select value={rotationOrderId} onChange={(event) => { const id = event.target.value; const order = orders.find((entry) => entry.id === id); const group = rotationGroups.find((entry) => entry.id === rotationGroupId); setRotationOrderId(id); if (!order || !group) { setOrderName(group ? `${group.name} rotation` : "Volunteer rotation"); setOrderSlots(group?.members.map((member, index) => ({ key: `new-${member.id}-${index}`, individualId: member.id, name: member.name })) ?? []); setBatchSize(1); setNotificationLeadDays(7); setNotifyEmail(true); setNotifySms(true); setNotifyDayBefore(false); } else { setOrderName(order.name); setOrderSlots(orderEntriesToSlots(order.entries)); setBatchSize(order.batchSize); setNotificationLeadDays(order.notificationLeadDays); setNotifyEmail(order.notifyEmail); setNotifySms(order.notifySms); setNotifyDayBefore(order.notifyDayBefore); } }} className="rounded-lg border border-ink/20 bg-white px-3 py-2 font-normal">
              <option value="">Create a new order</option>
              {orders.filter((order) => order.groupId === rotationGroupId).map((order) => <option key={order.id} value={order.id}>{order.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Order name<input value={orderName} onChange={(event) => setOrderName(event.target.value)} className="rounded-lg border border-ink/20 px-3 py-2 font-normal" /></label>
          <div>
            <p className="text-sm font-semibold">Drag to set volunteer order</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderSlots.map((slot) => slot.key)} strategy={verticalListSortingStrategy}>
                <ol className="mt-2 grid gap-2">{orderSlots.map((slot) => <SortableVolunteer key={slot.key} id={slot.key} name={slot.name} onRemove={() => setOrderSlots((current) => current.filter((entry) => entry.key !== slot.key))} />)}</ol>
              </SortableContext>
            </DndContext>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select value={newSlotVolunteerId} onChange={(event) => setNewSlotVolunteerId(event.target.value)} className="rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm">
              <option value="">Add volunteer to rotation</option>
              {(rotationGroups.find((group) => group.id === rotationGroupId)?.members ?? []).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <button type="button" disabled={!newSlotVolunteerId} onClick={addVolunteerSlot} className="focus-ring rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold disabled:opacity-40">Add</button>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Volunteers per event<input type="number" min={1} max={50} value={batchSize} onChange={(event) => setBatchSize(Math.max(1, Number(event.target.value) || 1))} className="rounded-lg border border-ink/20 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Notify volunteers<input type="number" min={0} max={365} value={notificationLeadDays} onChange={(event) => setNotificationLeadDays(Math.max(0, Number(event.target.value) || 0))} className="rounded-lg border border-ink/20 px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">Days before the event</span></label>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={notifyEmail} onChange={(event) => setNotifyEmail(event.target.checked)} />Email</label><label className="flex items-center gap-2"><input type="checkbox" checked={notifySms} onChange={(event) => setNotifySms(event.target.checked)} />SMS</label></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyDayBefore} onChange={(event) => setNotifyDayBefore(event.target.checked)} />Send a second notification 24 hours before the event</label>
          <div className="grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => void saveRotationOrder()} className="focus-ring rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink/90">Save order</button><button type="button" disabled={!rotationOrderId} onClick={() => void applyRotation()} className="focus-ring rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral disabled:opacity-40">Apply next batch</button><button type="button" disabled={!rotationOrderId} onClick={() => void applyRotationToLinkedEvents()} className="focus-ring rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal-900 disabled:opacity-40">Apply to linked events</button></div>
          <button type="button" disabled={!rotationOrderId} onClick={() => void moveBackOneBatch()} className="focus-ring rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40">Move back one batch</button>
          {rotationOrderId && <button type="button" onClick={() => void deleteRotationOrder()} className="focus-ring rounded-lg border border-coral/40 px-3 py-2 text-sm font-semibold text-coral">Delete rotation order</button>}
        </div> : <div className="mt-5 rounded-xl border border-dashed border-ink/20 p-5 text-sm text-ink/55">No volunteer groups are available.</div>}
      </section>
    </div>
    {overrideAssignment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="override-volunteer-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="override-volunteer-title" className="font-serif text-2xl">Override volunteer</h2><p className="mt-1 text-sm text-ink/60">Replace {overrideAssignment.individual.firstName} {overrideAssignment.individual.lastName ?? ""} for this event only.</p></div><button type="button" onClick={() => setOverrideAssignment(null)} className="focus-ring rounded-md px-2 py-1 text-sm text-ink/60">Close</button></div>
        <div className="mt-5 grid gap-2">{(rotationGroups.find((group) => group.id === overrideAssignment.groupId)?.members ?? []).filter((member) => member.id !== overrideAssignment.individual.id).map((member) => <button key={member.id} type="button" onClick={() => void saveEventOverride(member.id)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-left text-sm hover:border-coral hover:bg-coral/[.05]">{member.name}</button>)}</div>
      </div>
    </div>}
  </div>;
}
