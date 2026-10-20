"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export function SiteHeaderFrame({ sticky, stylistic, style, children }: { sticky: boolean; stylistic: boolean; style: CSSProperties; children: ReactNode }) {
  const [scrollingUp, setScrollingUp] = useState(false);

  useEffect(() => {
    if (!sticky || !stylistic) return;
    let previous = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      setScrollingUp(current < previous && current > 8);
      previous = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sticky, stylistic]);

  return <header className={`site-header border-b border-black/10 ${sticky ? "sticky top-0 z-40" : ""} ${stylistic && scrollingUp ? "is-stylistic is-scrolling-up" : ""}`} style={style}>{children}</header>;
}
