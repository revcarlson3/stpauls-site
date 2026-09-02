"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { Container } from "@/components/ui";

export default function InviteUserPage() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), role: data.get("role"), groupId: null }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Invitation sent." : body.error ?? "Unable to send invitation.");
    if (response.ok) event.currentTarget.reset();
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p><h1 className="mt-2 font-serif text-4xl">Invite user</h1><p className="mt-3 max-w-xl text-ink/60">The invitee will create their own password through a single-use link that expires after seven days.</p><form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><label className="grid gap-1 text-sm font-semibold">Name<input required name="name" minLength={2} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Email<input required name="email" type="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Initial role<select name="role" defaultValue="viewer" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Send invitation</button>{message && <p role="status" className="text-sm">{message}</p>}</form></Container></main>;
}
