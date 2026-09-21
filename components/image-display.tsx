"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type ImageDisplayProps = {
  src: string;
  alt: string;
  imageStyle?: CSSProperties;
  objectFit?: "contain" | "cover" | "fill";
  hoverEffect?: "none" | "zoom" | "lift" | "grayscale";
  hoverOverlay?: boolean;
  hoverOverlayColor?: string;
  hoverOverlayOpacity?: number;
  hoverText?: string;
  lightbox?: boolean;
  enterAnimation?: "none" | "fade" | "slide-up" | "slide-left" | "zoom";
  exitAnimation?: "none" | "fade" | "slide-down" | "slide-right" | "zoom-out";
  animationTrigger?: "load" | "viewport";
};

export function ImageDisplay({
  src,
  alt,
  imageStyle,
  objectFit = "contain",
  hoverEffect = "none",
  hoverOverlay = false,
  hoverOverlayColor = "#17324d",
  hoverOverlayOpacity = 0.45,
  hoverText = "",
  lightbox = false,
  enterAnimation = "none",
  exitAnimation = "none",
  animationTrigger = "load",
}: ImageDisplayProps) {
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(animationTrigger === "load");
  const [hasEntered, setHasEntered] = useState(animationTrigger === "load");
  const imageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canInteract = lightbox;
  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  useEffect(() => {
    if (animationTrigger !== "viewport" || !imageRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        setHasEntered(true);
      } else if (hasEntered) {
        setInView(false);
      }
    }, { threshold: 0.15 });
    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [animationTrigger, hasEntered]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, open]);

  return (
    <>
      <div ref={imageRef} className={`group relative block max-w-full overflow-hidden rounded-lg text-left image-animation-${inView ? enterAnimation : exitAnimation} image-animation-${inView ? "enter" : "exit"}`}>
        {canInteract ? <button type="button" ref={triggerRef} className="focus-ring block max-w-full cursor-zoom-in" onClick={() => setOpen(true)} aria-label={`Open ${alt || "image"} in lightbox`}>
          <img src={src} alt={alt} className={`block max-w-full transition duration-300 ease-out ${hoverEffect === "zoom" ? "group-hover:scale-105" : hoverEffect === "lift" ? "group-hover:-translate-y-1 group-hover:shadow-lg" : hoverEffect === "grayscale" ? "grayscale group-hover:grayscale-0" : ""}`} style={{ ...imageStyle, objectFit }} />
        </button> : <img src={src} alt={alt} className={`block max-w-full transition duration-300 ease-out ${hoverEffect === "zoom" ? "group-hover:scale-105" : hoverEffect === "lift" ? "group-hover:-translate-y-1 group-hover:shadow-lg" : hoverEffect === "grayscale" ? "grayscale group-hover:grayscale-0" : ""}`} style={{ ...imageStyle, objectFit }} />}
        {hoverOverlay && <span aria-hidden={!hoverText} className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center font-semibold text-white opacity-0 transition duration-300 group-hover:opacity-100" style={{ backgroundColor: hoverOverlayColor, opacity: undefined }}>
          <span className="absolute inset-0" style={{ backgroundColor: hoverOverlayColor, opacity: hoverOverlayOpacity }} />
          {hoverText && <span className="relative z-10">{hoverText}</span>}
        </span>}
      </div>
      {open && typeof document !== "undefined" && createPortal(<div role="dialog" aria-modal="true" aria-label={alt || "Image preview"} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6" onClick={close}>
        <button ref={closeRef} type="button" aria-label="Close image preview" className="focus-ring absolute right-5 top-5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink" onClick={close}>Close</button>
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[92vw] object-contain" onClick={(event) => event.stopPropagation()} />
      </div>, document.body)}
    </>
  );
}
