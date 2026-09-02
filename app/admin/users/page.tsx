"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

type Group = { id: string; name: string };
type User = { id: string; email: string; name: string; role: string; isActive: boolean; groupId: string | null; group?: { name: string } | null; isCurrent: boolean };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/users"), fetch("/api/security-groups")]).then(async ([usersResponse, groupsResponse]) => {
      if (!usersResponse.ok || !groupsResponse.ok) throw new Error("You do not have permission to manage users.");
      setUsers(await usersResponse.json());
      setGroups((await groupsResponse.json()).map((group: Group) => ({ id: group.id, name: group.name })));
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  async function saveUser(user: User, form: HTMLFormElement) {
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: password || undefined, groupId: data.get("groupId") || null, isActive: data.get("isActive") === "on" })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Unable to update this user.");
      return;
    }

    const updated = await response.json();
    setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    const passwordInput = form.elements.namedItem("password");
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    setError("");
  }

  async function removeUser(user: User) {
    if (!window.confirm(`Delete the account for ${user.email}? This cannot be undone.`)) return;
    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Unable to delete this user.");
      return;
    }
    setUsers((current) => current.filter((item) => item.id !== user.id));
  }

  return <main><Container className="py-10 sm:py-14">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p>
    <h1 className="mt-2 font-serif text-4xl">Users</h1>
    <p className="mt-2 max-w-2xl text-ink/60">Update account details, reset passwords, and assign security groups. Profile images will connect to membership and media storage in a later module.</p>
    {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <label className="mt-8 block max-w-xl text-sm font-semibold">Search users<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or group" className="focus-ring mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">{users.filter((user) => `${user.name} ${user.email} ${user.group?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())).map((user) => <Card key={user.id}>
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl">{user.name}</h2><p className="mt-1 text-xs text-ink/50">{user.email} · legacy role: {user.role}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? "bg-mist" : "bg-red-100 text-red-700"}`}>{user.isActive ? "Active" : "Inactive"}</span></div>
      <form className="mt-6 grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveUser(user, event.currentTarget); }}>
        <label className="grid gap-1 text-sm font-semibold">Name<input name="name" required minLength={2} defaultValue={user.name} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Email<input name="email" required type="email" defaultValue={user.email} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Security group<select name="groupId" disabled={user.isCurrent} defaultValue={user.groupId ?? ""} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">No group assigned</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>{user.isCurrent && <span className="text-xs font-normal text-ink/50">You cannot change your own security group.</span>}</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input name="isActive" type="checkbox" defaultChecked={user.isActive} disabled={user.isCurrent} className="focus-ring h-4 w-4" /> Active account{user.isCurrent && <span className="text-xs font-normal text-ink/50">(your account cannot be deactivated)</span>}</label>
        <label className="grid gap-1 text-sm font-semibold">Reset password <span className="font-normal text-ink/50">(leave blank to keep current password)</span><input name="password" type="password" minLength={12} autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <div className="flex flex-wrap gap-3"><button type="submit" className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95f43]">Save user</button>{!user.isCurrent && <button type="button" onClick={() => void removeUser(user)} className="focus-ring w-fit rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral hover:bg-coral hover:text-white">Delete user</button>}</div>
      </form>
    </Card>)}</div>
  </Container></main>;
}
