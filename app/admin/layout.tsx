"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui";
import { ModuleNavigation } from "@/components/module-navigation";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-mist/40">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-mist/40">
      <header className="border-b border-ink/10 bg-white">
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <Link href="/admin" className="focus-ring font-serif text-xl font-bold">Site administration</Link>
            <p className="text-xs text-ink/55">Management workspace</p>
          </div>
          <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/">View site</Link>
        </Container>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-ink/10 bg-white lg:min-h-[calc(100vh-5rem)] lg:w-64 lg:border-b-0 lg:border-r">
          <nav aria-label="Admin navigation" className="grid gap-1 p-4 sm:p-6">
            <Link className="focus-ring rounded-lg bg-mist px-4 py-3 font-semibold hover:bg-coral hover:text-white" href="/admin">Admin Dashboard</Link>
            <details open className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Pages <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages">Pages</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/add">Add a Page</Link>
              </div>
            </details>
            <details open className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Security <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security">Security Groups</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security/settings">Settings</Link>
              </div>
            </details>
            <details open className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Users <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users/add">Add User</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users">Edit Users</Link>
              </div>
            </details>
            <details open className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Navigation <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation">Menus</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation/locations">Locations</Link>
              </div>
            </details>
            <Link className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" href="/admin/theme">Theme</Link>
            <Link className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" href="/admin/site-settings">Site Settings</Link>
            <ModuleNavigation />
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
