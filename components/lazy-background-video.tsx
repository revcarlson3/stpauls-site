"use client";

import { useEffect, useState } from "react";

export function LazyBackgroundVideo({
  src,
  className,
  controls = false,
  mediaQuery
}: {
  src: string;
  className?: string;
  controls?: boolean;
  mediaQuery?: string;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = mediaQuery ? window.matchMedia(mediaQuery) : null;
    let timer: number | null = null;
    const update = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (media && !media.matches) {
        setEnabled(false);
        return;
      }
      timer = window.setTimeout(() => setEnabled(true), 150);
    };
    update();
    media?.addEventListener("change", update);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      media?.removeEventListener("change", update);
    };
  }, [mediaQuery]);

  return <video className={className} src={enabled ? src : undefined} controls={controls} autoPlay muted loop playsInline preload="metadata" />;
}
