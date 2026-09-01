"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export function PublicAccountNav({ authenticated }: { authenticated: boolean }) {
  if (!authenticated) return <Link className="focus-ring hover:text-coral" href="/register">Join</Link>;

  return (
    <>
      <Link className="focus-ring rounded-full border border-ink/20 px-4 py-2 hover:border-coral hover:text-coral" href="/admin/editor">
        Editor
      </Link>
      <button type="button" className="focus-ring text-ink/70 hover:text-coral" onClick={() => signOut({ callbackUrl: "/" })}>
        Logout
      </button>
    </>
  );
}

