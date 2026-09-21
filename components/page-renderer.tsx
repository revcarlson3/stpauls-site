import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { blockDefinitions, parseTableConfig } from "@/lib/blocks";
import { listPublicWidgets, resolvePublicMenu, resolvePublicWidget } from "@/lib/content";
import { MenuLinks } from "@/components/menu-links";
import { TableBlock } from "@/components/table-block";
import { Carousel, type CarouselSlide } from "@/components/carousel";
import { ImageDisplay } from "@/components/image-display";
import { FormRenderer } from "@/components/form-renderer";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { PublicWidget } from "@/components/public-widget";
import { PublicEventCalendar } from "@/components/public-event-calendar";

type RenderBlock = {
  id: string;
  type: string;
  title?: string;
  props?: Record<string, unknown>;
};

function isRenderBlock(value: unknown): value is RenderBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  return typeof block.id === "string" && typeof block.type === "string";
}

function childBlocks(block: RenderBlock) {
  return Array.isArray(block.props?.children) ? block.props.children : [];
}

function youtubeEmbedUrl(value: unknown, props: Record<string, unknown>) {
  if (typeof value !== "string" || !value) return null;
  let videoId = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/)?.[1];
  if (!videoId && /^[\w-]{6,}$/.test(value)) videoId = value;
  if (!videoId) return null;
  const query = new URLSearchParams();
  if (props.youtubeStart) query.set("start", String(props.youtubeStart));
  if (props.youtubeEnd) query.set("end", String(props.youtubeEnd));
  if (props.youtubeAutoplay === true) query.set("autoplay", "1");
  if (props.youtubeMute !== false) query.set("mute", "1");
  if (props.youtubeLoop === true) { query.set("loop", "1"); query.set("playlist", videoId); }
  if (props.youtubeControls === false) query.set("controls", "0");
  return `https://www.youtube-nocookie.com/embed/${videoId}?${query.toString()}`;
}

function safeRichText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "");
}

function publicOverlayStyle(props: Record<string, unknown>): CSSProperties {
  if (props.overlayType === "image" && typeof props.overlayImage === "string" && props.overlayImage) return { backgroundImage: `url("${props.overlayImage}")`, backgroundSize: "cover", backgroundPosition: "center" };
  if (props.overlayType === "gradient") return { backgroundImage: `linear-gradient(${typeof props.overlayAngle === "string" ? props.overlayAngle : "180"}deg, ${typeof props.overlayColor === "string" ? props.overlayColor : "#17324d"}, ${typeof props.overlaySecondaryColor === "string" ? props.overlaySecondaryColor : "#e66f51"})` };
  if (props.overlayType === "color") return { backgroundColor: typeof props.overlayColor === "string" ? props.overlayColor : "#17324d" };
  return {};
}

function overlayOpacity(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) / 100 : 0.45;
}

function cssDimension(value: unknown, unit: unknown) {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return undefined;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  if (unit === "full") return `${numericValue === 100 ? 100 : numericValue}%`;
  if (typeof unit !== "string" || !["%", "px", "em", "vh", "vw"].includes(unit)) return undefined;
  return `${numericValue}${unit}`;
}

const responsiveDevices = ["tablet", "mobile"] as const;

function cssPixel(value: unknown) {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue}px` : undefined;
}

function responsiveSettings(props: Record<string, unknown>, device: typeof responsiveDevices[number]) {
  const value = props.responsive;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = (value as Record<string, unknown>)[device];
  return settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : null;
}

function responsiveString(props: Record<string, unknown>, key: string, device: typeof responsiveDevices[number]) {
  const value = responsiveSettings(props, device)?.[key];
  return typeof value === "string" ? value : undefined;
}

function responsiveContentClass(props: Record<string, unknown>, key: string) {
  return responsiveDevices.map((device) => responsiveString(props, key, device) !== undefined ? `responsive-content-has-${device}` : "").filter(Boolean).join(" ");
}

function responsiveText({ props, name, fallback, className = "", id }: { props: Record<string, unknown>; name: string; fallback: string; className?: string; id?: string }) {
  return <div id={id} className={`${className} ${responsiveContentClass(props, name)}`}>
    <div className="responsive-content-base" dangerouslySetInnerHTML={{ __html: safeRichText(props[name]) || fallback }} />
    {responsiveDevices.map((device) => {
      const value = responsiveString(props, name, device);
      return value === undefined ? null : <div key={device} className={`responsive-content-variant responsive-content-${device}`} dangerouslySetInnerHTML={{ __html: safeRichText(value) }} />;
    })}
  </div>;
}

function responsivePlainText(props: Record<string, unknown>, name: string, fallback: string) {
  return <>
    <span className="responsive-content-base">{typeof props[name] === "string" && props[name] ? String(props[name]) : fallback}</span>
    {responsiveDevices.map((device) => {
      const value = responsiveString(props, name, device);
      return value === undefined ? null : <span key={device} className={`responsive-content-variant responsive-content-${device}`}>{value}</span>;
    })}
  </>;
}

function listItemsFrom(value: unknown) {
  return typeof value === "string" ? String(value).split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean) : [];
}

type RenderListConfig = {
  items: Array<{ id: string; text: string }>;
  bullet: "disc" | "circle" | "square" | "arrow" | "check" | "xmark" | "star" | "none";
  bulletColor: string;
  textColor: string;
  markerSize: "sm" | "md" | "lg";
  gap: "sm" | "md" | "lg";
  indent: "compact" | "comfortable";
  numberStyle: "decimal" | "lower-alpha" | "upper-alpha" | "lower-roman" | "upper-roman";
  start: number;
  reversed: boolean;
};

function renderListConfig(value: unknown): RenderListConfig {
  const fallback: RenderListConfig = { items: [], bullet: "disc", bulletColor: "#e66f51", textColor: "#17324d", markerSize: "md", gap: "md", indent: "comfortable", numberStyle: "decimal", start: 1, reversed: false };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Partial<RenderListConfig>;
      if (Array.isArray(parsed.items)) return { ...fallback, ...parsed, items: parsed.items.filter((item): item is { id: string; text: string } => Boolean(item && typeof item.id === "string" && typeof item.text === "string")) };
    } catch {
      // Fall through to the legacy newline format.
    }
    fallback.items = listItemsFrom(value).map((text, index) => ({ id: `list-item-${index}`, text }));
  }
  return fallback;
}

function listMarker(bullet: RenderListConfig["bullet"], color: string, size: RenderListConfig["markerSize"]) {
  if (bullet === "none") return null;
  const dimension = size === "lg" ? 22 : size === "sm" ? 14 : 18;
  if (bullet === "disc" || bullet === "circle" || bullet === "square") return <span aria-hidden="true" className={`mt-1 shrink-0 ${bullet === "disc" || bullet === "circle" ? "rounded-full" : ""}`} style={{ width: dimension, height: dimension, backgroundColor: bullet === "circle" ? "transparent" : color, border: bullet === "circle" ? `2px solid ${color}` : undefined }} />;
  return <svg aria-hidden="true" width={dimension} height={dimension} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">{bullet === "arrow" && <><path d="M4 12h14" /><path d="m13 5 7 7-7 7" /></>}{bullet === "check" && <path d="m5 12 4 4L19 6" />}{bullet === "xmark" && <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>}{bullet === "star" && <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill={color} />}</svg>;
}

function formatListNumber(value: number, style: RenderListConfig["numberStyle"]) {
  if (style === "decimal") return String(value);
  if (style === "lower-alpha" || style === "upper-alpha") {
    const letter = String.fromCharCode(97 + Math.max(0, value - 1) % 26);
    return style === "upper-alpha" ? letter.toUpperCase() : letter;
  }
  const roman = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]] as const;
  let remaining = Math.max(1, value);
  let result = "";
  for (const [unit, numeral] of roman) while (remaining >= unit) { result += numeral; remaining -= unit; }
  return style === "upper-roman" ? result.toUpperCase() : result;
}

function backgroundMediaLayers(props: Record<string, unknown>) {
  const baseUrl = typeof props.backgroundUrl === "string" ? props.backgroundUrl : "";
  return <>
    {props.backgroundType === "image" && baseUrl && <div aria-hidden="true" className="responsive-background-base responsive-background-image pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${baseUrl}")` }} />}
    {props.backgroundType === "video" && baseUrl && <video className="responsive-background-base responsive-background-video pointer-events-none absolute inset-0 h-full w-full object-cover" src={baseUrl} controls={props.videoControls === true} autoPlay loop={props.videoLoop === true} muted playsInline />}
    {responsiveDevices.map((device) => {
      const item = responsiveSettings(props, device);
      const url = typeof item?.backgroundUrl === "string" ? item.backgroundUrl : "";
      if (!url || (item?.backgroundType !== "image" && item?.backgroundType !== "video")) return null;
      return item.backgroundType === "image"
        ? <div key={`${device}-background`} aria-hidden="true" className={`responsive-background-variant responsive-background-${device} pointer-events-none absolute inset-0 bg-cover bg-center`} style={{ backgroundImage: `url("${url}")` }} />
        : <video key={`${device}-background`} className={`responsive-background-variant responsive-background-${device} pointer-events-none absolute inset-0 h-full w-full object-cover`} src={url} autoPlay muted loop playsInline />;
    })}
  </>;
}

function responsiveData(props: Record<string, unknown>) {
  const value = props.responsive;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const responsive = value as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const device of ["tablet", "mobile"] as const) {
    const settings = responsive[device];
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) continue;
    const item = settings as Record<string, unknown>;
    if (typeof item.hidden === "boolean") data[`data-${device}-hidden`] = String(item.hidden);
    if (typeof item.alignment === "string") data[`data-${device}-alignment`] = item.alignment;
    if (typeof item.padding === "string") data[`data-${device}-padding`] = item.padding;
    const width = cssDimension(item.widthValue, item.widthUnit);
    const height = cssDimension(item.heightValue, item.heightUnit);
    if (width) data[`data-${device}-width`] = width;
    if (height) data[`data-${device}-height`] = height;
    if (typeof item.columns === "number" && item.columns >= 1 && item.columns <= 12) data[`data-${device}-columns`] = String(Math.round(item.columns));
  }
  return data;
}

function responsiveStyle(props: Record<string, unknown>): CSSProperties {
  const style: Record<string, string> = {};
  const value = props.responsive;
  const responsive = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const basePadding = props.padding === "none" ? "0" : props.padding === "sm" ? "0.75rem" : props.padding === "lg" ? "2.5rem" : "1.5rem";
  const baseAlignment = props.alignment === "center" ? "center" : props.alignment === "right" ? "right" : "left";
  const baseFontSize = cssPixel(props.fontSize);
  const baseLetterSpacing = cssPixel(props.letterSpacing);
  if (props.hidden === true) style["--desktop-display"] = "none";
  if (baseFontSize) style["--desktop-font-size"] = baseFontSize;
  if (typeof props.fontWeight === "string" && props.fontWeight) style["--desktop-font-weight"] = props.fontWeight;
  if (typeof props.lineHeight === "string" && props.lineHeight) style["--desktop-line-height"] = props.lineHeight;
  if (baseLetterSpacing) style["--desktop-letter-spacing"] = baseLetterSpacing;
  if (typeof props.fontColor === "string" && props.fontColor) style["--desktop-font-color"] = props.fontColor;
  if (props.flexDirection === "column" || props.flexDirection === "row") style["--desktop-flex-direction"] = props.flexDirection;
  if (props.flexWrap === "nowrap" || props.flexWrap === "wrap") style["--desktop-flex-wrap"] = props.flexWrap;
  if (typeof props.flexGap === "string" && /^\d+$/.test(props.flexGap)) style["--desktop-flex-gap"] = `${props.flexGap}px`;
  if (typeof props.flexJustify === "string") style["--desktop-flex-justify"] = props.flexJustify === "center" ? "center" : props.flexJustify === "end" ? "flex-end" : props.flexJustify === "between" ? "space-between" : props.flexJustify === "around" ? "space-around" : "flex-start";
  if (typeof props.flexAlign === "string") style["--desktop-flex-align"] = props.flexAlign === "center" ? "center" : props.flexAlign === "end" ? "flex-end" : props.flexAlign === "start" ? "flex-start" : "stretch";
  for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
    const margin = cssPixel(props[`margin${side}`]);
    const padding = cssPixel(props[`padding${side}`]);
    if (margin) style[`--desktop-margin-${side.toLowerCase()}`] = margin;
    if (padding) style[`--desktop-padding-${side.toLowerCase()}`] = padding;
  }
  for (const device of responsiveDevices) {
    const settings = responsive[device];
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) continue;
    const item = settings as Record<string, unknown>;
    if (typeof item.hidden === "boolean") style[`--${device}-display`] = item.hidden ? "none" : "revert";
    if (typeof item.backgroundHidden === "boolean") style[`--${device}-background-display`] = item.backgroundHidden ? "none" : "block";
    if (typeof item.backgroundType === "string") style[`--${device}-background-base-display`] = "none";
    if (item.backgroundType === "color" && typeof item.backgroundColor === "string") style[`--${device}-background-color`] = item.backgroundColor;
    if (item.backgroundType === "none") style[`--${device}-background-color`] = "transparent";
    if (item.backgroundType === "image" && typeof item.backgroundUrl === "string" && item.backgroundUrl) style[`--${device}-background-image`] = `url("${item.backgroundUrl}")`;
    if (typeof item.overlayHidden === "boolean") style[`--${device}-overlay-display`] = item.overlayHidden ? "none" : "block";
    style[`--${device}-alignment`] = typeof item.alignment === "string" ? item.alignment === "center" ? "center" : item.alignment === "right" ? "right" : "left" : baseAlignment;
    style[`--${device}-padding`] = typeof item.padding === "string" ? item.padding === "none" ? "0" : item.padding === "sm" ? "0.75rem" : item.padding === "lg" ? "2.5rem" : "1.5rem" : basePadding;
    const fontSize = cssPixel(item.fontSize ?? props.fontSize);
    const letterSpacing = cssPixel(item.letterSpacing ?? props.letterSpacing);
    if (fontSize) style[`--${device}-font-size`] = fontSize;
    if (typeof (item.fontWeight ?? props.fontWeight) === "string") style[`--${device}-font-weight`] = String(item.fontWeight ?? props.fontWeight);
    if (typeof (item.lineHeight ?? props.lineHeight) === "string") style[`--${device}-line-height`] = String(item.lineHeight ?? props.lineHeight);
    if (letterSpacing) style[`--${device}-letter-spacing`] = letterSpacing;
    if (typeof item.fontColor === "string" && item.fontColor) style[`--${device}-font-color`] = item.fontColor;
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      const margin = cssPixel(item[`margin${side}`] ?? props[`margin${side}`]);
      const padding = cssPixel(item[`padding${side}`] ?? props[`padding${side}`]);
      if (margin) style[`--${device}-margin-${side.toLowerCase()}`] = margin;
      if (padding) style[`--${device}-padding-${side.toLowerCase()}`] = padding;
    }
    const width = cssDimension(item.widthValue ?? props.widthValue, item.widthUnit ?? props.widthUnit);
    const height = cssDimension(item.heightValue, item.heightUnit);
    if (width) style[`--${device}-width`] = width;
    if (height) style[`--${device}-height`] = height;
    const columns = typeof item.columns === "number" ? item.columns : props.columns;
    if (typeof columns === "number" && columns >= 1 && columns <= 12) style[`--${device}-columns`] = String(Math.round(columns));
    if (item.flexDirection === "column" || item.flexDirection === "row") style[`--${device}-flex-direction`] = item.flexDirection;
    if (item.flexWrap === "nowrap" || item.flexWrap === "wrap") style[`--${device}-flex-wrap`] = item.flexWrap;
    if (typeof item.flexGap === "string" && /^\d+$/.test(item.flexGap)) style[`--${device}-flex-gap`] = `${item.flexGap}px`;
    if (typeof item.flexJustify === "string") style[`--${device}-flex-justify`] = item.flexJustify === "center" ? "center" : item.flexJustify === "end" ? "flex-end" : item.flexJustify === "between" ? "space-between" : item.flexJustify === "around" ? "space-around" : "flex-start";
    if (typeof item.flexAlign === "string") style[`--${device}-flex-align`] = item.flexAlign === "center" ? "center" : item.flexAlign === "end" ? "flex-end" : item.flexAlign === "start" ? "flex-start" : "stretch";
  }
  return style as CSSProperties;
}

function carouselConfig(content: unknown) {
  try {
    const value = JSON.parse(typeof content === "string" ? content : "") as { slides?: CarouselSlide[]; autoplay?: boolean; interval?: string; controls?: boolean; indicators?: boolean };
    return { slides: Array.isArray(value.slides) ? value.slides : [], autoplay: value.autoplay === true, interval: Number(value.interval) || 5, controls: value.controls !== false, indicators: value.indicators !== false };
  } catch {
    return { slides: [], autoplay: false, interval: 5, controls: true, indicators: true };
  }
}

function buttonsConfig(content: unknown) {
  try {
    const value = JSON.parse(typeof content === "string" ? content : "") as { items?: Array<Record<string, unknown>>; layout?: string; alignment?: string };
    const items = Array.isArray(value.items) ? value.items.filter((item) => item && typeof item.id === "string" && typeof item.label === "string" && typeof item.href === "string").map((item) => ({ id: String(item.id), label: String(item.label), href: String(item.href), variant: item.variant === "secondary" || item.variant === "outline" || item.variant === "light" ? item.variant : "primary", size: item.size === "sm" || item.size === "lg" ? item.size : "md", target: item.target === "_blank" ? "_blank" : "_self" })) : [];
    return { items, layout: value.layout === "stack" ? "stack" : "row", alignment: value.alignment === "center" ? "center" : value.alignment === "right" ? "right" : "left" };
  } catch {
    return { items: [], layout: "row", alignment: "left" };
  }
}

function buttonGroup(config: ReturnType<typeof buttonsConfig>, headingId?: string) {
  const alignmentClass = config.alignment === "center" ? "justify-center" : config.alignment === "right" ? "justify-end" : "justify-start";
  const layoutClass = config.layout === "stack" ? "flex-col items-stretch" : "flex-row items-center";
  return <div id={headingId} className={`flex flex-wrap gap-3 ${layoutClass} ${alignmentClass}`}>{config.items.map((button) => <a key={button.id} href={button.href} target={button.target} rel={button.target === "_blank" ? "noreferrer" : undefined} className={`responsive-typography focus-ring inline-flex w-full items-center justify-center rounded-full text-center font-semibold transition hover:opacity-90 sm:w-auto ${button.variant === "secondary" ? "bg-[rgb(var(--color-ink))] text-white" : button.variant === "outline" ? "border-2 border-[rgb(var(--color-coral))] text-[rgb(var(--color-coral))]" : button.variant === "light" ? "bg-white text-[rgb(var(--color-ink))]" : "bg-[rgb(var(--color-coral))] text-white"} ${button.size === "sm" ? "px-4 py-2 text-sm" : button.size === "lg" ? "px-8 py-4 text-lg" : "px-5 py-3 text-base"}`}>{button.label}</a>)}</div>;
}

function BlockSurface({ as, children, className = "", style, background, overlay, overlayOpacity: opacity }: { as: "section" | "aside" | "footer"; labelledBy: string; children: ReactNode; className?: string; style?: CSSProperties; background?: ReactNode; overlay?: CSSProperties; overlayOpacity?: number }) {
  const surfaceClass = `responsive-block relative overflow-hidden bg-transparent p-6 ${className}`;
  const content = <>{background}{overlay && <div aria-hidden="true" className="responsive-overlay pointer-events-none absolute inset-0 z-0" style={{ ...overlay, opacity }} />}<div className="relative z-10">{children}</div></>;
  if (as === "aside") return <aside className={surfaceClass} style={style}>{content}</aside>;
  if (as === "footer") return <footer className={surfaceClass} style={style}>{content}</footer>;
  return <section className={surfaceClass} style={style}>{content}</section>;
}

export async function PageRenderer({ blocks, columns }: { blocks: unknown; columns?: number }) {
  const validBlocks = Array.isArray(blocks) ? blocks.filter((block) => isRenderBlock(block) && block.type !== "header" && block.type !== "footer") : [];
  const renderedBlocks = await Promise.all(validBlocks.map(async (block) => {
    const definition = blockDefinitions[block.type as keyof typeof blockDefinitions];
    const label = definition?.label ?? block.type;
    const title = typeof block.props?.title === "string" ? block.props.title : block.title ?? definition?.label ?? "Content block";
    const headingLevel = block.type === "headline" && typeof block.props?.headingLevel === "string" && /^h[1-6]$/.test(block.props.headingLevel) ? block.props.headingLevel as "h1" | "h2" | "h3" | "h4" | "h5" | "h6" : "h2";
    const menuId = typeof block.props?.menuId === "string" ? block.props.menuId : null;
    const menuLocationId = typeof block.props?.menuLocationId === "string" ? block.props.menuLocationId : null;
    const menu = ["hero", "sidebar"].includes(block.type)
      ? await resolvePublicMenu(menuId, menuLocationId)
      : null;
    const widgetId = typeof block.props?.widgetId === "string" ? block.props.widgetId : null;
    const widget = block.type === "widget" ? await resolvePublicWidget(widgetId) : null;

    const surfaceType = block.type === "sidebar" ? "aside" : "section";
    const headingId = `block-heading-${block.id}`;
    const alignment = block.props?.alignment === "center" ? "text-center" : block.props?.alignment === "right" ? "text-right" : "text-left";
    const padding = block.props?.padding === "none" ? "p-0" : block.props?.padding === "sm" ? "p-3" : block.props?.padding === "lg" ? "p-10" : "";
    const overlay = publicOverlayStyle(block.props ?? {});
    const background = block.props?.backgroundHidden === true ? null : backgroundMediaLayers(block.props ?? {});
    const width = cssDimension(block.props?.widthValue, block.props?.widthUnit);
    const blockStyle = block.props?.backgroundTransparent === true
      ? { backgroundColor: "transparent" }
      : typeof block.props?.backgroundColor === "string"
        ? { backgroundColor: block.props.backgroundColor }
        : undefined;
    const style: CSSProperties = {
      ...blockStyle,
      ...responsiveStyle(block.props ?? {}),
      ...(!["image", "map"].includes(block.type) && typeof block.props?.heightValue === "string" && typeof block.props?.heightUnit === "string" ? { height: `${block.props.heightValue}${block.props.heightUnit}` } : {}),
      ...(!["image", "map"].includes(block.type) && width ? { width } : {}),
      ...(!["image", "map"].includes(block.type) && (block.props?.marginTop || block.props?.marginRight || block.props?.marginBottom || block.props?.marginLeft) ? { marginTop: typeof block.props.marginTop === "string" ? `${block.props.marginTop}px` : undefined, marginRight: typeof block.props.marginRight === "string" ? `${block.props.marginRight}px` : undefined, marginBottom: typeof block.props.marginBottom === "string" ? `${block.props.marginBottom}px` : undefined, marginLeft: typeof block.props.marginLeft === "string" ? `${block.props.marginLeft}px` : undefined } : {}),
      ...(typeof block.props?.borderRadius === "string" ? { borderRadius: `${block.props.borderRadius}px` } : {}),
      ...(block.props?.borderStyle && block.props.borderStyle !== "none" ? { borderStyle: block.props.borderStyle as CSSProperties["borderStyle"], borderWidth: `${typeof block.props.borderWidth === "string" ? block.props.borderWidth : "1"}px`, borderColor: typeof block.props.borderColor === "string" ? block.props.borderColor : undefined } : {}),
      ...(!["image", "map"].includes(block.type) ? { boxSizing: "border-box" } : {}),
      ...(block.props?.justify === "center" ? { marginLeft: "auto", marginRight: "auto" } : block.props?.justify === "right" ? { marginLeft: "auto" } : {})
    };
    const imageStyle: CSSProperties = {
      ...(typeof block.props?.heightValue === "string" && typeof block.props?.heightUnit === "string" ? { height: `${block.props.heightValue}${block.props.heightUnit}` } : {}),
      ...(width ? { width } : {}),
      ...(block.props?.marginTop || block.props?.marginRight || block.props?.marginBottom || block.props?.marginLeft ? { marginTop: typeof block.props.marginTop === "string" ? `${block.props.marginTop}px` : undefined, marginRight: typeof block.props.marginRight === "string" ? `${block.props.marginRight}px` : undefined, marginBottom: typeof block.props.marginBottom === "string" ? `${block.props.marginBottom}px` : undefined, marginLeft: typeof block.props.marginLeft === "string" ? `${block.props.marginLeft}px` : undefined } : {}),
      ...(typeof block.props?.borderRadius === "string" ? { borderRadius: `${block.props.borderRadius}px` } : {}),
      ...(block.props?.borderStyle && block.props.borderStyle !== "none" ? { borderStyle: block.props.borderStyle as CSSProperties["borderStyle"], borderWidth: `${typeof block.props.borderWidth === "string" ? block.props.borderWidth : "1"}px`, borderColor: typeof block.props.borderColor === "string" ? block.props.borderColor : undefined } : {})
    };
    const animation = typeof block.props?.animation === "string" && block.props.animation !== "none" ? `block-animation-${block.props.animation}` : "";
    if (block.type === "container" || block.type === "flex" || block.type === "grid") {
      const columns = typeof block.props?.columns === "number" ? Math.max(1, Math.min(12, Math.round(block.props.columns))) : 2;
      const structuralStyle = { ...style };
      const flexDirection = block.props?.flexDirection === "column" ? "column" : "row";
      const flexWrap = block.props?.flexWrap === "nowrap" ? "nowrap" : "wrap";
      const flexJustify = block.props?.flexJustify === "center" ? "center" : block.props?.flexJustify === "end" ? "flex-end" : block.props?.flexJustify === "between" ? "space-between" : block.props?.flexJustify === "around" ? "space-around" : "flex-start";
      const flexAlign = block.props?.flexAlign === "center" ? "center" : block.props?.flexAlign === "end" ? "flex-end" : block.props?.flexAlign === "start" ? "flex-start" : "stretch";
      const flexGap = typeof block.props?.flexGap === "string" && /^\d+$/.test(block.props.flexGap) ? `${block.props.flexGap}px` : "16px";
      return (
        <section key={block.id} className={`responsive-block ${block.type === "grid" ? "responsive-grid" : ""} site-layout-container relative overflow-hidden ${block.type === "grid" ? "grid gap-6" : ""} ${padding} p-5 ${alignment} ${animation}`} style={structuralStyle}>
          {background}
          {block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true && <div aria-hidden="true" className="responsive-overlay pointer-events-none absolute inset-0 z-0" style={{ ...overlay, opacity: overlayOpacity(block.props.overlayOpacity) }} />}
          <div className={`relative z-10 h-full min-h-full ${block.type === "grid" ? "responsive-grid-content flex flex-col" : block.type === "flex" ? "responsive-flex-content flex" : "flex flex-col"} ${block.props?.verticalAlign === "center" ? "justify-center" : block.props?.verticalAlign === "bottom" ? "justify-end" : "justify-start"}`} style={block.type === "flex" ? { flexDirection, flexWrap, justifyContent: flexJustify, alignItems: flexAlign, gap: flexGap } : undefined}><PageRenderer blocks={childBlocks(block)} columns={block.type === "grid" ? columns : undefined} /></div>
        </section>
      );
    }
    if (block.type === "youtube") {
      const src = youtubeEmbedUrl(block.props?.youtubeUrl, block.props ?? {});
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>{src ? <div className="mt-4 aspect-video overflow-hidden rounded-lg"><iframe title={title} src={src} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="mt-3 text-ink/60">Add a YouTube URL in the element settings.</p>}</BlockSurface>;
    }
    if (block.type === "buttons") {
      const buttons = buttonsConfig(block.props?.content);
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><div className={responsiveContentClass(block.props ?? {}, "content")}><div className="responsive-content-base">{buttonGroup(buttons, headingId)}</div>{responsiveDevices.map((device) => { const content = responsiveString(block.props ?? {}, "content", device); return content === undefined ? null : <div key={device} className={`responsive-content-variant responsive-content-${device}`}>{buttonGroup(buttonsConfig(content), headingId)}</div>; })}</div></BlockSurface>;
    }
    if (block.type === "table") {
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><TableBlock config={parseTableConfig(block.props?.content)} /></BlockSurface>;
    }
    if (block.type === "calendar") {
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><PublicEventCalendar /></BlockSurface>;
    }
    if (block.type === "form") {
      const formId = typeof block.props?.formId === "string" ? block.props.formId : "";
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>{formId ? <FormRenderer formId={formId} title={typeof block.props?.title === "string" ? block.props.title : undefined} alignment={block.props?.alignment === "center" ? "center" : block.props?.alignment === "right" ? "right" : "left"} /> : <p className="text-ink/60">Choose a reusable form in the element settings.</p>}</BlockSurface>;
    }
    if (block.type === "cta") {
      const legacyPanel = { id: `legacy-${block.id}`, title, content: typeof block.props?.content === "string" ? block.props.content : "<p>Invite people to take the next step.</p>", buttonLabel: typeof block.props?.ctaButtonLabel === "string" ? block.props.ctaButtonLabel : "Learn more", buttonHref: typeof block.props?.ctaButtonHref === "string" && block.props.ctaButtonHref ? block.props.ctaButtonHref : "#", buttonVariant: block.props?.ctaButtonVariant === "secondary" || block.props?.ctaButtonVariant === "outline" || block.props?.ctaButtonVariant === "light" ? block.props.ctaButtonVariant : "primary", buttonTarget: block.props?.ctaButtonTarget === "_blank" ? "_blank" : "_self" };
      const rawPanels = block.props?.ctaPanels;
      const panels: Array<Record<string, unknown>> = Array.isArray(rawPanels) && rawPanels.length ? rawPanels.filter((panel: unknown): panel is Record<string, unknown> => Boolean(panel && typeof panel === "object" && !Array.isArray(panel))) : [legacyPanel as Record<string, unknown>];
      const columns = typeof block.props?.ctaColumns === "number" ? Math.max(1, Math.min(5, Math.round(block.props.ctaColumns))) : 1;
      const gap = block.props?.ctaGap === "sm" ? "gap-3" : block.props?.ctaGap === "lg" ? "gap-8" : "gap-5";
      const alignmentClass = block.props?.ctaAlignment === "center" ? "text-center" : block.props?.ctaAlignment === "right" ? "text-right" : "text-left";
      const panelStyle = block.props?.ctaPanelStyle === "outlined" ? "border border-[rgb(var(--color-coral))]" : block.props?.ctaPanelStyle === "minimal" ? "border-b border-[rgb(var(--color-ink)/.2)]" : "bg-white/70 shadow-sm";
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`cta-block ${padding} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><div id={headingId} className={`mx-auto grid max-w-6xl ${columns === 2 ? "grid-cols-1 md:grid-cols-2" : columns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : columns === 4 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : columns === 5 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-5" : "grid-cols-1"} ${gap} ${alignmentClass}`}>{panels.map((panel, index) => { const panelTitle = typeof panel.title === "string" ? panel.title : `CTA ${index + 1}`; const panelContent = typeof panel.content === "string" ? panel.content : "<p>Invite people to take the next step.</p>"; const buttonLabel = typeof panel.buttonLabel === "string" ? panel.buttonLabel : "Learn more"; const buttonHref = typeof panel.buttonHref === "string" && panel.buttonHref ? panel.buttonHref : "#"; const buttonTarget = panel.buttonTarget === "_blank" ? "_blank" : "_self"; const buttonVariant = panel.buttonVariant === "secondary" || panel.buttonVariant === "outline" || panel.buttonVariant === "light" ? panel.buttonVariant : "primary";       const buttonClass = buttonVariant === "secondary" ? "bg-[rgb(var(--color-ink))] text-white" : buttonVariant === "outline" ? "border-2 border-[rgb(var(--color-coral))] text-[rgb(var(--color-coral))]" : buttonVariant === "light" ? "bg-white text-[rgb(var(--color-ink))]" : "bg-[rgb(var(--color-coral))] text-white"; const buttonSize = panel.buttonSize === "sm" ? "px-3 py-1.5 text-sm" : panel.buttonSize === "xl" ? "px-8 py-5 text-lg" : panel.buttonSize === "md" ? "px-5 py-3 text-base" : "px-6 py-4 text-lg"; const buttonAlignment = panel.buttonAlignment === "center" ? "justify-center" : panel.buttonAlignment === "right" ? "justify-end" : "justify-start"; const imageUrl = typeof panel.imageUrl === "string" ? panel.imageUrl : ""; const imageDisplay = panel.imageDisplay === "above" || panel.imageDisplay === "beside" || panel.imageDisplay === "background" ? panel.imageDisplay : "none"; const imageFit = panel.imageFit === "contain" || panel.imageFit === "fill" ? panel.imageFit : "cover"; const imagePosition = panel.imagePosition === "left" ? "left" : panel.imagePosition === "right" ? "right" : "center";       const panelImage = imageUrl && imageDisplay !== "none" && imageDisplay !== "background" ? <img src={imageUrl} alt={typeof panel.imageAlt === "string" ? panel.imageAlt : ""} className={`max-h-48 w-full rounded-lg transition duration-300 ${imageDisplay === "above" ? "-mx-6 -mt-6 mb-2 w-[calc(100%+3rem)] rounded-none" : imageDisplay === "beside" ? "md:w-2/5" : ""} ${panel.imageHoverEffect === "zoom" ? "hover:scale-105" : panel.imageHoverEffect === "lift" ? "hover:-translate-y-1 hover:shadow-lg" : panel.imageHoverEffect === "grayscale" ? "grayscale hover:grayscale-0" : ""}`} style={{ objectFit: imageFit, objectPosition: imagePosition }} /> : null; return <article key={typeof panel.id === "string" ? panel.id : `${block.id}-${index}`} className={`relative grid content-start gap-3 overflow-hidden rounded-xl p-6 ${panelStyle} ${imageDisplay === "beside" ? "md:flex md:items-start" : ""}`} style={imageUrl && imageDisplay === "background" ? { backgroundImage: `linear-gradient(rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.78)), url("${imageUrl}")`, backgroundSize: imageFit, backgroundPosition: imagePosition } : undefined}>{panelImage}<div className="relative min-w-0"><h2 className="responsive-typography text-2xl font-semibold tracking-tight">{panelTitle}</h2><div className="responsive-typography rich-text-content text-ink/70" dangerouslySetInnerHTML={{ __html: safeRichText(panelContent) }} />      <div className={`mt-2 flex flex-wrap gap-2 ${buttonAlignment}`}><a href={buttonHref} target={buttonTarget} rel={buttonTarget === "_blank" ? "noreferrer" : undefined} className={`focus-ring inline-flex w-full items-center justify-center rounded-full text-center font-semibold shadow-sm transition hover:opacity-90 sm:w-auto ${buttonSize} ${buttonClass}`}>{buttonLabel}</a></div></div></article>; })}</div></BlockSurface>;
    }
    if (block.type === "hero") {
      const mediaUrl = typeof block.props?.mediaUrl === "string" ? block.props.mediaUrl : "";
      const mediaType = block.props?.mediaType === "video" ? "video" : "image";
      return (
        <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`hero-block !border-0 !shadow-none ${padding} ${alignment} ${animation}`} style={{ ...style, border: 0, boxShadow: "none", outline: "none" }} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>
          {mediaUrl && (mediaType === "video" ? <video className="absolute inset-0 h-full w-full object-cover" src={mediaUrl} autoPlay muted loop playsInline /> : <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
          <div id={headingId} className="relative z-10">
            {responsiveText({ props: block.props ?? {}, name: "content", fallback: "<p>Add hero text in the element editor.</p>", className: "responsive-typography rich-text-content mt-3 text-ink/70" })}
            {menu && (["buttons", "small-buttons", "large-buttons"].includes(String(block.props?.menuStyle)) ? <nav aria-label={`${label} actions`} className="mt-5"><div className="flex flex-wrap gap-3">{menu.items.filter((item) => !item.parentId).map((item) => <Link key={item.id} href={item.href} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noreferrer" : undefined} className={`focus-ring inline-flex rounded-full bg-[rgb(var(--color-coral))] font-semibold text-white shadow-sm transition hover:opacity-90 ${block.props?.menuStyle === "large-buttons" ? "px-10 py-6 text-lg" : "px-5 py-3 text-sm"}`}>{item.label}</Link>)}</div></nav> : <nav aria-label={`${label} navigation`} className="mt-5 rounded-lg bg-sand/60 p-4 text-sm font-semibold"><MenuLinks items={menu.items} /></nav>)}
          </div>
        </BlockSurface>
      );
    }
    if (block.type === "image") {
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background}>{typeof block.props?.imageUrl === "string" && block.props.imageUrl ? <div className="relative mt-4 inline-block max-w-full overflow-hidden rounded-lg"><ImageDisplay src={block.props.imageUrl} alt={typeof block.props.imageAlt === "string" ? block.props.imageAlt : ""} imageStyle={imageStyle} objectFit={block.props.imageFit === "cover" ? "cover" : block.props.imageFit === "fill" ? "fill" : "contain"} hoverEffect={block.props.imageHoverEffect === "zoom" || block.props.imageHoverEffect === "lift" || block.props.imageHoverEffect === "grayscale" ? block.props.imageHoverEffect : "none"} hoverOverlay={block.props.imageHoverOverlay === true} hoverOverlayColor={typeof block.props.imageHoverOverlayColor === "string" ? block.props.imageHoverOverlayColor : "#17324d"} hoverOverlayOpacity={Number(block.props.imageHoverOverlayOpacity ?? 45) / 100} hoverText={typeof block.props.imageHoverText === "string" ? block.props.imageHoverText : ""} lightbox={block.props.imageLightbox === true} enterAnimation={block.props.imageEnterAnimation === "fade" || block.props.imageEnterAnimation === "slide-up" || block.props.imageEnterAnimation === "slide-left" || block.props.imageEnterAnimation === "zoom" ? block.props.imageEnterAnimation : "none"} exitAnimation={block.props.imageExitAnimation === "fade" || block.props.imageExitAnimation === "slide-down" || block.props.imageExitAnimation === "slide-right" || block.props.imageExitAnimation === "zoom-out" ? block.props.imageExitAnimation : "none"} animationTrigger={block.props.imageAnimationTrigger === "viewport" ? "viewport" : "load"} />{block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true && <div aria-hidden="true" className="responsive-overlay pointer-events-none absolute inset-0" style={{ ...overlay, opacity: overlayOpacity(block.props.overlayOpacity) }} />}</div> : <p className="mt-3 text-ink/60">Add an image URL in the element settings.</p>}</BlockSurface>;
    }
    if (block.type === "map") {
      const address = typeof block.props?.mapAddress === "string" ? block.props.mapAddress : "";
      const provider = block.props?.mapProvider === "bing" ? "https://www.bing.com/maps?q=" : block.props?.mapProvider === "openstreetmap" ? "https://www.openstreetmap.org/export/embed.html?query=" : "https://www.google.com/maps?q=";
      const src = address ? `${provider}${encodeURIComponent(address)}${block.props?.mapProvider === "google" ? "&output=embed" : ""}` : "";
      const mapStyle: CSSProperties = { ...(typeof block.props?.heightValue === "string" && typeof block.props?.heightUnit === "string" ? { height: `${block.props.heightValue}${block.props.heightUnit}` } : { height: "20rem" }), ...(typeof block.props?.widthValue === "string" && typeof block.props?.widthUnit === "string" ? { width: block.props.widthUnit === "full" ? "100%" : `${block.props.widthValue}${block.props.widthUnit}` } : { width: "100%" }), ...(typeof block.props?.marginTop === "string" ? { marginTop: `${block.props.marginTop}px` } : {}), ...(typeof block.props?.marginRight === "string" ? { marginRight: `${block.props.marginRight}px` } : {}), ...(typeof block.props?.marginBottom === "string" ? { marginBottom: `${block.props.marginBottom}px` } : {}), ...(typeof block.props?.marginLeft === "string" ? { marginLeft: `${block.props.marginLeft}px` } : {}), ...(typeof block.props?.borderRadius === "string" ? { borderRadius: `${block.props.borderRadius}px` } : {}), ...(block.props?.borderStyle && block.props.borderStyle !== "none" ? { borderStyle: block.props.borderStyle as CSSProperties["borderStyle"], borderWidth: `${typeof block.props.borderWidth === "string" ? block.props.borderWidth : "1"}px`, borderColor: typeof block.props.borderColor === "string" ? block.props.borderColor : undefined } : {}) };
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>{src ? <iframe title={title} src={src} className="mt-4 max-w-full rounded-lg border-0" style={mapStyle} loading="lazy" /> : <p className="mt-3 text-ink/60">Add a location in the element settings.</p>}</BlockSurface>;
    }
    if (block.type === "carousel") {
      const carousel = carouselConfig(block.props?.content);
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><div className={responsiveContentClass(block.props ?? {}, "content")}><div className="responsive-content-base"><Carousel slides={carousel.slides} autoplay={carousel.autoplay} interval={carousel.interval} controls={carousel.controls} indicators={carousel.indicators} /></div>{responsiveDevices.map((device) => { const content = responsiveString(block.props ?? {}, "content", device); if (content === undefined) return null; const variant = carouselConfig(content); return <div key={device} className={`responsive-content-variant responsive-content-${device}`}><Carousel slides={variant.slides} autoplay={variant.autoplay} interval={variant.interval} controls={variant.controls} indicators={variant.indicators} /></div>; })}</div></BlockSurface>;
    }
    if (block.type === "blockquote") {
      const quoteStyle = block.props?.blockquoteStyle === "centered" || block.props?.blockquoteStyle === "boxed" || block.props?.blockquoteStyle === "quotation" || block.props?.blockquoteStyle === "minimal" ? block.props.blockquoteStyle : "classic";
      const quoteClass = quoteStyle === "centered" ? "text-center font-serif text-xl italic" : quoteStyle === "boxed" ? "rounded-xl border border-ink/10 bg-sand/60 p-6 font-serif text-xl italic shadow-sm" : quoteStyle === "quotation" ? "relative border-t-2 border-coral/40 pt-8 font-serif text-2xl italic before:absolute before:left-0 before:top-0 before:text-7xl before:font-normal before:not-italic before:leading-none before:text-coral before:content-['“']" : quoteStyle === "minimal" ? "border-y border-ink/15 py-5 font-serif text-xl italic" : "border-l-4 border-coral pl-5 font-serif text-2xl italic";
      const quoteAlignment = quoteStyle === "centered" ? "text-center" : "text-left";
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><blockquote id={headingId} className={`responsive-typography blockquote-content blockquote-style-${quoteStyle} ${quoteAlignment} ${quoteClass} ${responsiveContentClass(block.props ?? {}, "content")}`}>{responsivePlainText(block.props ?? {}, "content", "Add a quote in the element content.")}</blockquote>{(block.props?.quoteCitation || responsiveString(block.props ?? {}, "quoteCitation", "tablet") !== undefined || responsiveString(block.props ?? {}, "quoteCitation", "mobile") !== undefined) && <cite className={`mt-3 block ${quoteAlignment} text-sm not-italic text-ink/60 ${responsiveContentClass(block.props ?? {}, "quoteCitation")}`}>— {responsivePlainText(block.props ?? {}, "quoteCitation", "")}</cite>}</BlockSurface>;
    }
    if (block.type === "list") {
      const renderList = (value: unknown, suffix: string) => {
        const config = renderListConfig(value);
        const ordered = block.props?.listStyle === "ordered";
        const gap = config.gap === "sm" ? "gap-1" : config.gap === "lg" ? "gap-4" : "gap-2";
        const markerWidth = config.markerSize === "lg" ? "w-7" : config.markerSize === "sm" ? "w-5" : "w-6";
        return <div className={`mt-2 grid ${gap} text-left ${config.indent === "comfortable" ? "pl-2" : ""}`} style={{ color: config.textColor }} role={ordered ? "list" : undefined}>{config.items.length ? config.items.map((item, index) => {
          const number = config.reversed ? config.start + config.items.length - index - 1 : config.start + index;
          return <div key={`${block.id}-${suffix}-${item.id}`} className="flex items-start gap-2" role="listitem"><span className={`${markerWidth} flex shrink-0 justify-end font-semibold`} style={{ color: config.bulletColor }}>{ordered ? <>{formatListNumber(number, config.numberStyle)}.</> : listMarker(config.bullet, config.bulletColor, config.markerSize)}</span><span>{item.text}</span></div>;
        }) : <div className="text-ink/50">Add list items in the element settings.</div>}</div>;
      };
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}><div id={headingId} className={`responsive-typography ${responsiveContentClass(block.props ?? {}, "listItems")}`}><div className="responsive-content-base">{renderList(block.props?.listItems, "base")}</div>{responsiveDevices.map((device) => { const value = responsiveString(block.props ?? {}, "listItems", device); return value === undefined ? null : <div key={device} className={`responsive-content-variant responsive-content-${device}`}>{renderList(value, device)}</div>; })}</div></BlockSurface>;
    }
    if (block.type === "body") {
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>{responsiveText({ props: block.props ?? {}, name: "content", fallback: "<p>Add text in the element editor.</p>", className: "responsive-typography rich-text-content text-left text-ink/70", id: headingId })}</BlockSurface>;
    }
    if (block.type === "news" || block.type === "sidebar") {
      return <BlockSurface key={block.id} as={block.type === "sidebar" ? "aside" : "section"} labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>
        <h2 id={headingId} className="responsive-typography font-serif text-2xl">{title}</h2>
        {responsiveText({ props: block.props ?? {}, name: "content", fallback: "", className: "responsive-typography rich-text-content mt-3 text-left text-ink/70" })}
        {menu && <nav aria-label={`${label} navigation`} className="mt-5 border-t border-ink/10 pt-4 text-sm font-semibold"><MenuLinks items={menu.items} /></nav>}
      </BlockSurface>;
    }
    if (block.type === "widget") {
      const config = widget?.config && typeof widget.config === "object" && !Array.isArray(widget.config) ? widget.config as Record<string, unknown> : {};
      const widgetMenu = widget?.type === "menu" && typeof config.menuId === "string" ? await resolvePublicMenu(config.menuId, null) : null;
      return <BlockSurface key={block.id} as="section" labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>{widget?.type === "text" && typeof config.content === "string" ? <div id={headingId} className="rich-text-content text-left text-ink/70" dangerouslySetInnerHTML={{ __html: safeRichText(config.content) }} /> : widgetMenu ? <nav id={headingId} aria-label={`${widget?.name ?? "Widget"} navigation`} className="text-sm font-semibold"><MenuLinks items={widgetMenu.items} /></nav> : null}</BlockSurface>;
    }
    return (
      <BlockSurface key={block.id} as={surfaceType} labelledBy={headingId} className={`${padding} ${alignment} ${animation}`} style={style} background={background} overlay={block.props?.overlayType && block.props.overlayType !== "none" && block.props.overlayHidden !== true ? overlay : undefined} overlayOpacity={overlayOpacity(block.props?.overlayOpacity)}>
        {block.type === "headline" ? (() => { const Heading = headingLevel; return <Heading id={headingId} className={`responsive-typography mt-2 font-serif text-3xl ${responsiveContentClass(block.props ?? {}, "title")}`}>{responsivePlainText(block.props ?? {}, "title", title)}</Heading>; })() : <h2 id={headingId} className={`responsive-typography mt-2 font-serif text-3xl ${responsiveContentClass(block.props ?? {}, "title")}`}>{responsivePlainText(block.props ?? {}, "title", title)}</h2>}
        {block.type !== "headline" && <p className="mt-3 text-ink/60">This {label.toLowerCase()} block is ready for its content fields.</p>}
        {menu && <nav aria-label={`${label} navigation`} className={`mt-5 border-t border-ink/10 pt-4 text-sm font-semibold ${block.type === "hero" ? "rounded-lg bg-sand/60 p-4" : ""}`}><MenuLinks items={menu.items} /></nav>}
      </BlockSurface>
    );
  }));

  return (
    <div className="site-block-stack grid" style={columns ? { display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "1.5rem" } : undefined}>
      {renderedBlocks}
    </div>
  );
}

export async function PublishedPageShell({ title, blocks, editHref, pageId, pageSlug, pageThemeFamily, pageThemeWidth, showHeader = true, showFooter = true, fullScreen = false }: { title: string; blocks: unknown; editHref?: string; pageId?: string; pageSlug?: string; pageThemeFamily?: string | null; pageThemeWidth?: string | null; showHeader?: boolean; showFooter?: boolean; fullScreen?: boolean }) {
  const user = editHref ? await getCurrentUser() : null;
  const canEdit = user ? await hasPermission(user.id, "EDIT_PAGES") : false;
  const [sidebarWidgets, pageWidgets] = await Promise.all([
    listPublicWidgets("sidebar"),
    listPublicWidgets("page", pageId, pageSlug)
  ]);
  const themeFamily = pageThemeFamily === "tailwind" || pageThemeFamily === "material" || pageThemeFamily === "classic" ? pageThemeFamily : null;
  const themeWidth = pageThemeWidth === "full" || pageThemeWidth === "contained" ? pageThemeWidth : null;
  return (
    <div className={`${showHeader ? "" : "page-chrome-hide-header"} ${showFooter ? "" : "page-chrome-hide-footer"}`}>
      {canEdit && editHref && <Link href={editHref} className="focus-ring fixed bottom-4 right-4 z-50 rounded-full bg-ink px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg transition-colors hover:bg-coral">Edit page</Link>}
      <div className={`site-page-shell ${fullScreen ? "page-fullscreen" : ""} ${themeFamily ? `page-theme-${themeFamily}` : ""} ${themeWidth ? `page-width-${themeWidth}` : ""}`}>
        <div className={sidebarWidgets.length ? "site-page-layout" : ""}>
          <main className="site-page-content"><PageRenderer blocks={blocks} />{pageWidgets.length > 0 && <aside className="site-page-widgets grid gap-4" aria-label="Page widgets">{pageWidgets.map((widget) => <PublicWidget key={widget.id} widget={widget} />)}</aside>}</main>
          {sidebarWidgets.length > 0 && <aside className="site-sidebar-widgets grid gap-4" aria-label="Sidebar">{sidebarWidgets.map((widget) => <PublicWidget key={widget.id} widget={widget} />)}</aside>}
        </div>
      </div>
    </div>
  );
}
