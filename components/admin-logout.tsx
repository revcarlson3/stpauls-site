"use client";

import { signOut } from "next-auth/react";

export function AdminLogout() {
  return <button type="button" className="focus-ring mt-6 rounded-lg border-t border-ink/10 px-4 py-3 text-left font-semibold text-coral hover:bg-sand" onClick={() => void signOut({ callbackUrl: "/" })}>Logout</button>;
}
