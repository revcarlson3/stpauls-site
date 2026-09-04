"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ModuleLink = { slug: string; name: string; href: string };

export function ModuleNavigation() {
  const [modules, setModules] = useState<ModuleLink[]>([]);
  useEffect(() => {
    void fetch("/api/modules").then((response) => response.ok ? response.json() : null).then((value) => {
      if (value?.modules) setModules(value.modules);
    }).catch(() => undefined);
  }, []);
  if (!modules.length) return null;
  return <>{modules.map((module) => module.slug === "membership" ? <details key={module.slug} open className="group"><summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">{module.name} <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary><div className="ml-4 grid gap-1 border-l border-ink/10 pl-2"><Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href={module.href}>Directory</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/membership/custom-fields">Custom Fields</Link></div></details> : <Link key={module.slug} className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" href={module.href}>{module.name}</Link>)}</>;
}
