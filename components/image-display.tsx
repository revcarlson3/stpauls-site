"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useInView, type TargetAndTransition } from "motion/react";

type ImageDisplayProps = {
  src: string;
  alt: string;
  imageStyle?: CSSProperties;
  containerStyle?: CSSProperties;
  objectFit?: "contain" | "cover" | "fill";
  hoverEffect?: "none" | "zoom" | "lift" | "grayscale";
  hoverOverlay?: boolean;
  hoverOverlayColor?: string;
  hoverOverlayOpacity?: number;
  hoverText?: string;
  lightbox?: boolean;
  linkUrl?: string;
  linkTarget?: "_self" | "_blank";
  enterAnimation?: "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom" | "zoom-out" | "bounce" | "flip" | "rotate" | "blur" | "elastic" | "shake";
  exitAnimation?: "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom" | "zoom-out" | "bounce" | "flip" | "rotate" | "blur" | "elastic" | "shake";
  animationTrigger?: "load" | "viewport";
};

export function ImageDisplay({
  src,
  alt,
  imageStyle,
  containerStyle,
  objectFit = "contain",
  hoverEffect = "none",
  hoverOverlay = false,
  hoverOverlayColor = "#17324d",
  hoverOverlayOpacity = 0.45,
  hoverText = "",
  lightbox = false,
  linkUrl = "",
  linkTarget = "_self",
  enterAnimation = "none",
  exitAnimation = "none",
  animationTrigger = "load",
}: ImageDisplayProps) {
  const [open, setOpen] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inView = useInView(imageRef, { amount: 0.65, once: false });
  const safeLinkUrl = linkUrl.trim() && (/^https?:\/\//i.test(linkUrl.trim()) || (linkUrl.trim().startsWith("/") && !linkUrl.trim().startsWith("//"))) ? linkUrl.trim() : "";
  const canInteract = lightbox && !safeLinkUrl;
  const isVisible = animationTrigger === "load" || inView;
  const imageAnimation: { hidden: TargetAndTransition; visible: TargetAndTransition } = (() => {
    const visible = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, rotateX: 0, filter: "blur(0px)" };
    switch (enterAnimation) {
      case "slide-up": return { hidden: { opacity: 0, y: 48 }, visible };
      case "slide-down": return { hidden: { opacity: 0, y: -48 }, visible };
      case "slide-left": return { hidden: { opacity: 0, x: 48 }, visible };
      case "slide-right": return { hidden: { opacity: 0, x: -48 }, visible };
      case "zoom": return { hidden: { opacity: 0, scale: 0.72 }, visible };
      case "zoom-out": return { hidden: { opacity: 0, scale: 1.2 }, visible };
      case "bounce": return { hidden: { opacity: 0, scale: 0.72 }, visible, };
      case "flip": return { hidden: { opacity: 0, rotateX: -90 }, visible };
      case "rotate": return { hidden: { opacity: 0, rotate: -18, scale: 0.88 }, visible };
      case "blur": return { hidden: { opacity: 0, filter: "blur(14px)", scale: 1.04 }, visible };
      case "elastic": return { hidden: { opacity: 0, scale: 0.6 }, visible };
      case "shake": return { hidden: { opacity: 0, x: 0 }, visible: { ...visible, x: [0, -14, 14, -8, 8, 0] } };
      case "fade": return { hidden: { opacity: 0 }, visible };
      default: return { hidden: visible, visible };
    }
  })();
  const animationTransition = enterAnimation === "bounce" || enterAnimation === "elastic"
    ? { type: "spring" as const, stiffness: 280, damping: 15 }
    : enterAnimation === "shake"
      ? { duration: 0.7, ease: "easeInOut" as const }
      : { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };
  const exitHidden = (() => {
    switch (exitAnimation) {
      case "slide-up": return { opacity: 0, y: -48 };
      case "slide-down": return { opacity: 0, y: 48 };
      case "slide-left": return { opacity: 0, x: -48 };
      case "slide-right": return { opacity: 0, x: 48 };
      case "zoom": return { opacity: 0, scale: 0.72 };
      case "zoom-out": return { opacity: 0, scale: 1.2 };
      case "flip": return { opacity: 0, rotateX: 90 };
      case "rotate": return { opacity: 0, rotate: 18, scale: 0.88 };
      case "blur": return { opacity: 0, filter: "blur(14px)", scale: 1.04 };
      case "fade": return { opacity: 0 };
      default: return { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, rotateX: 0, filter: "blur(0px)" };
    }
  })();
  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
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
      <motion.div ref={imageRef} initial={imageAnimation.hidden} animate={isVisible ? imageAnimation.visible : exitHidden} transition={animationTransition} className="group relative block max-w-full overflow-hidden rounded-lg text-left" style={containerStyle}>
        {safeLinkUrl ? <a href={safeLinkUrl} target={linkTarget} rel={linkTarget === "_blank" ? "noreferrer" : undefined} className="block max-w-full">
          <img src={src} alt={alt} className={`block max-w-full transition duration-300 ease-out ${hoverEffect === "zoom" ? "group-hover:scale-105" : hoverEffect === "lift" ? "group-hover:-translate-y-1 group-hover:shadow-lg" : hoverEffect === "grayscale" ? "grayscale group-hover:grayscale-0" : ""}`} style={{ ...imageStyle, objectFit }} />
        </a> : canInteract ? <button type="button" ref={triggerRef} className="focus-ring block max-w-full cursor-zoom-in" onClick={() => setOpen(true)} aria-label={`Open ${alt || "image"} in lightbox`}>
          <img src={src} alt={alt} className={`block max-w-full transition duration-300 ease-out ${hoverEffect === "zoom" ? "group-hover:scale-105" : hoverEffect === "lift" ? "group-hover:-translate-y-1 group-hover:shadow-lg" : hoverEffect === "grayscale" ? "grayscale group-hover:grayscale-0" : ""}`} style={{ ...imageStyle, objectFit }} />
        </button> : <img src={src} alt={alt} className={`block max-w-full transition duration-300 ease-out ${hoverEffect === "zoom" ? "group-hover:scale-105" : hoverEffect === "lift" ? "group-hover:-translate-y-1 group-hover:shadow-lg" : hoverEffect === "grayscale" ? "grayscale group-hover:grayscale-0" : ""}`} style={{ ...imageStyle, objectFit }} />}
        {hoverOverlay && <span aria-hidden={!hoverText} className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center font-semibold text-white opacity-0 transition duration-300 group-hover:opacity-100" style={{ backgroundColor: hoverOverlayColor, opacity: undefined }}>
          <span className="absolute inset-0" style={{ backgroundColor: hoverOverlayColor, opacity: hoverOverlayOpacity }} />
          {hoverText && <span className="relative z-10">{hoverText}</span>}
        </span>}
      </motion.div>
      {open && typeof document !== "undefined" && createPortal(<div role="dialog" aria-modal="true" aria-label={alt || "Image preview"} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6" onClick={close}>
        <button ref={closeRef} type="button" aria-label="Close image preview" className="focus-ring absolute right-5 top-5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink" onClick={close}>Close</button>
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[92vw] object-contain" onClick={(event) => event.stopPropagation()} />
      </div>, document.body)}
    </>
  );
}
