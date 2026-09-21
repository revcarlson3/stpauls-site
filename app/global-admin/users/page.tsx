"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type User = { id: string; email: string; name: string; role: string; churchRole: string | null; isActive: boolean; mfaEnrollment: string; lastAccessAt: string | null; sessionState: string; groupId: string | null; group: { name: string } | null };
type Group = { id: string; name: string };

export default function GlobalAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { name: string; email: string; password: string }>>({});
  useEffect(() => {
    void Promise.all([fetch("/api/global-admin/users", { cache: "no-store" }), fetch("/api/global-admin/security-groups", { cache: "no-store" })]).then(async ([usersResponse, groupsResponse]) => {
      const usersBody = await usersResponse.json().catch(() => []);
      const groupsBody = await groupsResponse.json().catch(() => []);
      if (!usersResponse.ok || !groupsResponse.ok) throw new Error(usersBody.error ?? groupsBody.error ?? "Unable to load selected-site users.");
      setUsers(usersBody); setDrafts(Object.fromEntries(usersBody.map((user: User) => [user.id, { name: user.name, email: user.email, password: "" }]))); setGroups(groupsBody);
    }).catch((reason: Error) => setError(reason.message));
  }, []);
  async function mutate(url: string, body: Record<string, unknown>, successMessage: string) {
    setError(""); setSuccess("");
    const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/users")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to update user access."); return; }
    setUsers((current) => current.map((user) => user.id === value.id ? { ...user, ...value } : user));
    if (value.id) setDrafts((current) => ({ ...current, [value.id]: { ...(current[value.id] ?? { password: "" }), name: value.name ?? current[value.id]?.name ?? "", email: value.email ?? current[value.id]?.email ?? "", password: "" } }));
    setSuccess(successMessage);
  }
  async function revokeSessions(user: User) {
    setError(""); setSuccess("");
    const response = await fetch("/api/global-admin/users/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const value = await response.json().catch(() => ({}));
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/users")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to revoke sessions."); return; }
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, sessionState: "Revoked" } : item)); setSuccess("Sessions revoked.");
  }
  async function resetPassword(user: User) {
    setError(""); setSuccess("");
    if (!window.confirm(`Send a password reset link to ${user.email}?`)) return;
    const response = await fetch("/api/global-admin/users/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const value = await response.json().catch(() => ({}));
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/users")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to send a password reset link."); return; }
    setSuccess("Password reset link sent.");
  }
  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Bridge administration</p><h1 className="mt-3 font-serif text-4xl">Site users and security</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Users are limited to the selected active site. Sensitive access changes and session revocations require recent bridge reauthentication.</p></div><GlobalAdminBackLink /></div>
    {error && <p role="alert" className="mt-6 rounded-lg bg-coral/10 p-4 text-sm font-semibold text-coral">{error}</p>}{success && <p role="status" className="mt-6 rounded-lg bg-mist p-4 text-sm">{success}</p>}
    <div className="mt-8 grid gap-5 lg:grid-cols-2">{users.map((user) => { const draft = drafts[user.id] ?? { name: user.name, email: user.email, password: "" }; return <Card key={user.id} className="p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl">{user.name}</h2><p className="mt-1 text-sm text-ink/60">{user.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? "bg-mist" : "bg-red-100 text-red-700"}`}>{user.isActive ? "Active" : "Inactive"}</span></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><Info label="Site role" value={user.churchRole ?? "Member"} /><Info label="Legacy role" value={user.role} /><Info label="Security group" value={user.group?.name ?? "None"} /><Info label="MFA" value={user.mfaEnrollment} /><Info label="Last access" value={user.lastAccessAt ? new Date(user.lastAccessAt).toLocaleString() : "Never"} /><Info label="Session state" value={user.sessionState} /></dl><div className="mt-5 grid gap-3 border-t border-ink/10 pt-5"><label className="grid gap-1 text-sm font-semibold">Name<input value={draft.name} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, name: event.target.value } }))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Email / login identifier<input type="email" value={draft.email} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, email: event.target.value } }))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Set new password <span className="font-normal text-ink/50">(leave blank to keep current)</span><input type="password" autoComplete="new-password" value={draft.password} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, password: event.target.value } }))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><button type="button" onClick={() => void mutate("/api/global-admin/users", { userId: user.id, name: draft.name, email: draft.email, ...(draft.password ? { password: draft.password } : {}) }, "User details saved; sessions revoked if the password changed.")} className="focus-ring w-fit rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white">Save identity / password</button></div><div className="mt-4 grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Role<select value={user.role} onChange={(event) => void mutate("/api/global-admin/users", { userId: user.id, role: event.target.value }, "Role updated.")} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Administrator</option></select></label><label className="grid gap-1 text-sm font-semibold">Security group<select value={user.groupId ?? ""} onChange={(event) => void mutate("/api/global-admin/users", { userId: user.id, groupId: event.target.value || null }, "Security group updated.")} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>    <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void mutate("/api/global-admin/users", { userId: user.id, isActive: !user.isActive }, user.isActive ? "User deactivated." : "User reactivated.")} className="focus-ring rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">{user.isActive ? "Deactivate" : "Reactivate"}</button><button type="button" onClick={() => void resetPassword(user)} className="focus-ring rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">Send reset link</button><button type="button" onClick={() => void revokeSessions(user)} className="focus-ring rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">Revoke sessions</button></div></Card>; })}</div>
    {!users.length && !error && <Card className="mt-8 p-8"><p className="text-sm text-ink/60">No users belong to the selected site.</p></Card>}
  </Container></main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>; }
