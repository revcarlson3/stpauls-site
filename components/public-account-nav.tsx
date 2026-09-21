"use client";

import { signOut } from "next-auth/react";
import { clearAnnouncementSession } from "@/lib/announcement-session";
import Link from "next/link";

export function PublicAccountNav({ authenticated }: { authenticated: boolean }) {
  if (!authenticated) return <Link className="focus-ring hover:text-coral" href="/register">Join</Link>;

  return <button type="button" className="focus-ring text-ink/70 hover:text-coral" onClick={() => { clearAnnouncementSession(); void signOut({ callbackUrl: "/" }); }}>Logout</button>;
}
