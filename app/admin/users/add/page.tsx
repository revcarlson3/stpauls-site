"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";

type Group = { id: string; name: string };

export default function AddUser() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/security-groups").then(async (response) => {
      if (!response.ok) throw new Error("You do not have permission to manage users.");
      setGroups((await response.json()).map((group: Group) => ({ id: group.id, name: group.name })));
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        password: data.get("password"),
        role: data.get("role"),
        groupId: data.get("groupId") || null
      })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to create this user.");
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  return <main><Container className="py-10 sm:py-14">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p>
    <h1 className="mt-2 font-serif text-4xl">Add user</h1>
    <p className="mt-3 max-w-2xl text-ink/60">Create an account and assign its initial security group. The group controls permissions; the legacy role is retained for compatibility.</p>
    {error && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <form onSubmit={(event) => void submit(event)} className="mt-8 max-w-xl grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <label className="grid gap-1 text-sm font-semibold">Name<input name="name" required minLength={2} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-semibold">Email<input name="email" required type="email" autoComplete="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
      <label className="grid gap-1 text-sm font-semibold">Temporary password<input name="password" required type="password" autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/50">Must meet the current Security Settings password policy.</span></label>
      <label className="grid gap-1 text-sm font-semibold">Security group<select name="groupId" defaultValue="" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">No group assigned</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Legacy role<select name="role" defaultValue="viewer" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
      <button disabled={saving} className="focus-ring mt-2 w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95f43] disabled:opacity-60">{saving ? "Creating..." : "Create user"}</button>
    </form>
  </Container></main>;
}
