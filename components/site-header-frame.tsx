"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export function SiteHeaderFrame({ sticky, stylistic, style, children }: { sticky: boolean; stylistic: boolean; style: CSSProperties; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [scrollingUp, setScrollingUp] = useState(false);

  useEffect(() => {
    if (!sticky) return;
    let previous = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 8);
      setScrollingUp(current < previous && current > 8);
      previous = current;
    };
    setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sticky]);

  return <header className={`site-header border-b border-black/10 ${sticky ? "is-sticky sticky top-0 z-40" : ""} ${stylistic && scrolled ? "is-stylistic is-scrolled" : ""} ${scrollingUp ? "is-scrolling-up" : ""}`} style={style}>{children}</header>;
}
