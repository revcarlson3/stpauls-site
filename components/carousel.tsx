"use client";

import { useEffect, useState } from "react";

export type CarouselSlide = {
  id: string;
  mediaType: "image" | "video";
  imageUrl: string;
  videoUrl: string;
  alt: string;
  caption: string;
  linkUrl: string;
};

export function Carousel({ slides, autoplay, interval, controls, indicators }: { slides: CarouselSlide[]; autoplay: boolean; interval: number; controls: boolean; indicators: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const available = slides.filter((slide) => slide.mediaType === "video" ? slide.videoUrl : slide.imageUrl);

  useEffect(() => {
    if (active >= available.length) setActive(0);
  }, [active, available.length]);

  useEffect(() => {
    if (!autoplay || paused || available.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % available.length), Math.max(1000, interval) * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, available.length, interval, paused]);

  if (!available.length) return <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-ink/20 bg-sand/40 text-sm text-ink/50">Add carousel images in the element settings.</div>;
  const slide = available[active];
  const move = (direction: -1 | 1) => setActive((current) => (current + direction + available.length) % available.length);

  return <div className="relative overflow-hidden rounded-lg bg-ink/5" role="region" aria-roledescription="carousel" aria-label="Featured content">
    <div className="relative aspect-[16/9]">
      {slide.linkUrl ? <a href={slide.linkUrl} className="block h-full w-full">{slide.mediaType === "video" ? <video key={slide.id} src={slide.videoUrl} className="h-full w-full object-cover" autoPlay muted playsInline controls={false} /> : <img src={slide.imageUrl} alt={slide.alt} className="h-full w-full object-cover" />}</a> : slide.mediaType === "video" ? <video key={slide.id} src={slide.videoUrl} className="h-full w-full object-cover" autoPlay muted playsInline controls={false} /> : <img src={slide.imageUrl} alt={slide.alt} className="h-full w-full object-cover" />}
      {slide.caption && <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-4 py-3 text-sm text-white">{slide.caption}</div>}
      {controls && available.length > 1 && <><button type="button" aria-label="Previous slide" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/65 px-3 py-2 text-white" onClick={() => move(-1)}>‹</button><button type="button" aria-label="Next slide" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/65 px-3 py-2 text-white" onClick={() => move(1)}>›</button></>}
      {autoplay && available.length > 1 && <button type="button" aria-pressed={paused} className="focus-ring absolute right-3 top-3 rounded-full bg-ink/75 px-3 py-2 text-xs font-semibold text-white" onClick={() => setPaused((current) => !current)}>{paused ? "Play" : "Pause"}</button>}
    </div>
    {indicators && available.length > 1 && <div className="flex justify-center gap-2 p-3">{available.map((item, index) => <button key={item.id} type="button" aria-label={`Go to slide ${index + 1}`} aria-current={index === active ? "true" : undefined} className={`h-3 w-3 rounded-full ${index === active ? "bg-coral" : "bg-ink/20"}`} onClick={() => setActive(index)} />)}</div>}
  </div>;
}
