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
  return <>{modules.map((module) => <Link key={module.slug} className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" href={module.href}>{module.name}</Link>)}</>;
}
