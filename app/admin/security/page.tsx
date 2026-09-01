"use client";

import { useEffect, useState } from "react";
import { Container, Card } from "@/components/ui";

const permissionOptions = [
  ["ACCESS_ADMIN", "Access admin area"],
  ["EDIT_PAGES", "Edit pages"],
  ["PUBLISH_PAGES", "Publish pages"],
  ["MANAGE_MENUS", "Manage menus"],
  ["MANAGE_USERS", "Manage users and groups"],
  ["MANAGE_SETTINGS", "Manage settings"]
] as const;

type Group = { id: string; name: string; slug: string; permissions: { permission: string }[]; _count: { users: number } };

export default function SecurityPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/security-groups").then(async (response) => {
      if (!response.ok) throw new Error("You do not have permission to manage security groups.");
      setGroups(await response.json());
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  async function save(group: Group, permissions: string[]) {
    const response = await fetch(`/api/security-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: group.name, permissions })
    });
    if (!response.ok) {
      setError("Unable to save this security group.");
      return;
    }
    const updated = await response.json();
    setGroups((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p>
        <h1 className="mt-2 font-serif text-4xl">Security groups</h1>
        <p className="mt-2 max-w-2xl text-ink/60">Assign permission switches to groups instead of configuring each user individually. User assignment will be managed from the member administration workflow.</p>
        {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {groups.map((group) => {
              const selected = new Set(group.permissions.map((item) => item.permission));
              return <Card key={group.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div><h2 className="font-serif text-2xl">{group.name}</h2><p className="mt-1 text-xs text-ink/50">{group.slug} · {group._count.users} users</p></div>
                  <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">Group</span>
                </div>
                <div className="mt-6 grid gap-3">
                  {permissionOptions.map(([permission, label]) => <label key={permission} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={selected.has(permission)} onChange={(event) => {
                      const next = new Set(selected);
                      event.target.checked ? next.add(permission) : next.delete(permission);
                      void save(group, Array.from(next));
                    }} />
                    {label}
                  </label>)}
                </div>
              </Card>;
            })}
          </div>
        )}
      </Container>
    </main>
  );
}
