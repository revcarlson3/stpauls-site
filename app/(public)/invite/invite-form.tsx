"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      router.replace("/admin/login");
      return;
    }
    setMessage(body.error ?? "Unable to accept invitation.");
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto mt-8 grid max-w-lg gap-4 rounded-2xl border border-ink/10 bg-white p-6 text-left shadow-sm">
      <label className="grid gap-1 text-sm font-semibold">
        Create password
        <input required type="password" name="password" autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" />
        <span className="text-xs font-normal text-ink/50">Your password must meet the site&apos;s current security policy.</span>
      </label>
      <button className="focus-ring mx-auto w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Create account</button>
      {message && <p role="alert" className="text-sm text-coral">{message}</p>}
    </form>
  );
}
