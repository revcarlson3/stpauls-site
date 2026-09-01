"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export function PublicAccountNav({ authenticated }: { authenticated: boolean }) {
  if (!authenticated) return <Link className="focus-ring hover:text-coral" href="/register">Join</Link>;

  return <button type="button" className="focus-ring text-ink/70 hover:text-coral" onClick={() => signOut({ callbackUrl: "/" })}>Logout</button>;
}
