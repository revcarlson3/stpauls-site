"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card } from "@/components/ui";
import { blockDefinitions, defaultTableConfig, parseTableConfig, tableConfigContent, type BlockType, type TableConfig } from "@/lib/blocks";
import type { CarouselSlide } from "@/components/carousel";
import { MediaPicker } from "@/components/media-picker";
import { TableBlock } from "@/components/table-block";

type Block = {
  id: string;
  type: BlockType;
  hidden?: boolean;
  backgroundHidden?: boolean;
  title: string;
  content: string;
  mediaType?: "image" | "video";
  mediaUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFit?: "contain" | "cover" | "fill";
  imageHoverEffect?: "none" | "zoom" | "lift" | "grayscale";
  imageHoverOverlay?: boolean;
  imageHoverOverlayColor?: string;
  imageHoverOverlayOpacity?: string;
  imageHoverText?: string;
  imageLightbox?: boolean;
  imageEnterAnimation?: "none" | "fade" | "slide-up" | "slide-left" | "zoom";
  imageExitAnimation?: "none" | "fade" | "slide-down" | "slide-right" | "zoom-out";
  imageAnimationTrigger?: "load" | "viewport";
  youtubeUrl?: string;
  youtubeStart?: string;
  youtubeEnd?: string;
  youtubeAutoplay?: boolean;
  youtubeMute?: boolean;
  youtubeLoop?: boolean;
  youtubeControls?: boolean;
  mapProvider?: "google" | "bing" | "openstreetmap";
  mapAddress?: string;
  mapZoom?: string;
  quoteCitation?: string;
  blockquoteStyle?: "classic" | "centered" | "boxed" | "quotation" | "minimal";
  listItems?: string;
  listStyle?: "unordered" | "ordered";
  listItemsData?: ListItem[];
  listBullet?: ListBullet;
  listBulletColor?: string;
  listTextColor?: string;
  listMarkerSize?: "sm" | "md" | "lg";
  listGap?: "sm" | "md" | "lg";
  listIndent?: "compact" | "comfortable";
  listNumberStyle?: "decimal" | "lower-alpha" | "upper-alpha" | "lower-roman" | "upper-roman";
  listStart?: number;
  listReversed?: boolean;
  ctaButtonLabel?: string;
  ctaButtonHref?: string;
  ctaButtonVariant?: "primary" | "secondary" | "outline" | "light";
  ctaButtonTarget?: "_self" | "_blank";
  ctaPanels?: CtaPanel[];
  ctaColumns?: 1 | 2 | 3 | 4 | 5;
  ctaGap?: "sm" | "md" | "lg";
  ctaAlignment?: "left" | "center" | "right";
  ctaPanelStyle?: "filled" | "outlined" | "minimal";
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  fontSize?: string;
  fontColor?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  alignment?: "left" | "center" | "right";
  padding?: "none" | "sm" | "md" | "lg";
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  backgroundColor?: string;
  backgroundTransparent?: boolean;
  backgroundType?: "none" | "color" | "image" | "video";
  backgroundUrl?: string;
  overlayHidden?: boolean;
  overlayType?: "none" | "color" | "gradient" | "image";
  overlayColor?: string;
  overlaySecondaryColor?: string;
  overlayOpacity?: string;
  overlayImage?: string;
  overlayAngle?: string;
  heightValue?: string;
  heightUnit?: "%" | "px" | "em" | "vh" | "vw";
  widthValue?: string;
  widthUnit?: "%" | "px" | "em" | "vh" | "vw" | "full";
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  justify?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  flexGap?: string;
  flexJustify?: "start" | "center" | "end" | "between" | "around";
  flexAlign?: "start" | "center" | "end" | "stretch";
  videoControls?: boolean;
  videoAutoplay?: boolean;
  videoLoop?: boolean;
  videoMuted?: boolean;
  animation?: "none" | "fade-in" | "slide-up" | "slide-left" | "zoom-in";
  span: number;
  menuId?: string | null;
  menuLocationId?: string | null;
  menuStyle?: "links" | "buttons" | "small-buttons" | "large-buttons";
  widgetId?: string | null;
  formId?: string | null;
  columns?: number;
  children?: Block[];
  carouselSlides?: CarouselSlide[];
  carouselAutoplay?: boolean;
  carouselInterval?: string;
  carouselControls?: boolean;
  carouselIndicators?: boolean;
  responsive?: ResponsiveOverrides;
};

type CtaPanel = {
  id: string;
  title: string;
  content: string;
  buttonLabel: string;
  buttonHref: string;
  buttonVariant: "primary" | "secondary" | "outline" | "light";
  buttonSize: "sm" | "md" | "lg" | "xl";
  buttonAlignment: "left" | "center" | "right";
  buttonTarget: "_self" | "_blank";
  imageUrl?: string;
  imageAlt?: string;
  imageDisplay?: "none" | "above" | "beside" | "background";
  imageFit?: "cover" | "contain" | "fill";
  imagePosition?: "left" | "center" | "right";
  imageHoverEffect?: "none" | "zoom" | "lift" | "grayscale";
};

type ListBullet = "disc" | "circle" | "square" | "arrow" | "check" | "xmark" | "star" | "none";
type ListItem = { id: string; text: string };
type ListConfig = {
  items: ListItem[];
  bullet: ListBullet;
  bulletColor: string;
  textColor: string;
  markerSize: "sm" | "md" | "lg";
  gap: "sm" | "md" | "lg";
  indent: "compact" | "comfortable";
  numberStyle: "decimal" | "lower-alpha" | "upper-alpha" | "lower-roman" | "upper-roman";
  start: number;
  reversed: boolean;
};

function defaultListConfig(items: ListItem[] = []): ListConfig {
  return { items, bullet: "disc", bulletColor: "#e66f51", textColor: "#17324d", markerSize: "md", gap: "md", indent: "comfortable", numberStyle: "decimal", start: 1, reversed: false };
}

function parseListConfig(value: string | undefined): ListConfig {
  if (value) {
    try {
      const parsed = JSON.parse(value) as Partial<ListConfig>;
      if (Array.isArray(parsed.items)) return { ...defaultListConfig(), ...parsed, items: parsed.items.filter((item): item is ListItem => Boolean(item && typeof item.id === "string" && typeof item.text === "string")) };
    } catch {
      // Legacy lists are newline-delimited.
    }
  }
  const items = (value ?? "").split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text, index) => ({ id: `list-item-${index}`, text }));
  return defaultListConfig(items);
}

function formatEditorListNumber(value: number, style: ListConfig["numberStyle"]) {
  if (style === "decimal") return String(value);
  if (style === "lower-alpha" || style === "upper-alpha") {
    const letter = String.fromCharCode(97 + Math.max(0, value - 1) % 26);
    return style === "upper-alpha" ? letter.toUpperCase() : letter;
  }
  const roman = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]] as const;
  let remaining = Math.max(1, value);
  let result = "";
  for (const [unit, numeral] of roman) while (remaining >= unit) { result += numeral; remaining -= unit; }
  return style === "upper-roman" ? result.toUpperCase() : result;
}

type ResponsiveDevice = "desktop" | "tablet" | "mobile";
type ResponsiveOverrides = {
  tablet?: ResponsiveSettings;
  mobile?: ResponsiveSettings;
};
type ResponsiveSettings = {
  hidden?: boolean;
  backgroundHidden?: boolean;
  backgroundType?: Block["backgroundType"];
  backgroundColor?: string;
  backgroundUrl?: string;
  title?: string;
  content?: string;
  quoteCitation?: string;
  listItems?: string;
  ctaButtonLabel?: string;
  ctaButtonHref?: string;
  ctaButtonVariant?: Block["ctaButtonVariant"];
  ctaButtonTarget?: Block["ctaButtonTarget"];
  fontSize?: string;
  fontColor?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  alignment?: Block["alignment"];
  padding?: Block["padding"];
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  widthValue?: string;
  widthUnit?: Block["widthUnit"];
  heightValue?: string;
  heightUnit?: Block["heightUnit"];
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  justify?: Block["justify"];
  verticalAlign?: Block["verticalAlign"];
  flexDirection?: Block["flexDirection"];
  flexWrap?: Block["flexWrap"];
  flexGap?: string;
  flexJustify?: Block["flexJustify"];
  flexAlign?: Block["flexAlign"];
  overlayHidden?: boolean;
  columns?: number;
};
type PageInput = {
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishAt: string | null;
  pageThemeFamily: string | null;
  pageThemeWidth: string | null;
  showHeader: boolean;
  showFooter: boolean;
  fullScreen: boolean;
  expectedUpdatedAt?: string;
  accessPassword?: string | null;
  blocks: ReturnType<typeof serialize>[];
};
type RecoveryOffer = { savedAt: string; input: PageInput };
type RevisionSummary = { id: string; title: string; kind: "MANUAL" | "AUTOSAVE"; createdAt: string; author: { name: string }; snapshot?: PageInput | null; blocks: unknown };

function hasRecoverableDraft(input: PageInput) {
  return Boolean(input.title.trim() || input.slug.trim() || input.seoTitle || input.seoDescription || input.seoKeywords || input.publishAt || input.pageThemeFamily || input.pageThemeWidth || input.blocks.length);
}
const standardBackgroundColors = [
  ["White", "#ffffff"],
  ["Mist", "#f3f6f8"],
  ["Sand", "#f4eee6"],
  ["Ink", "#17324d"],
  ["Black", "#000000"],
  ["Coral", "#e66f51"],
  ["Blue", "#2563eb"],
  ["Green", "#15803d"],
] as const;
type MenuOption = { id: string; name: string };
type LocationOption = { id: string; name: string };
type MenuPreview = { id: string; name: string; items: Array<{ id: string; label: string; parentId: string | null }> };
type WidgetOption = { id: string; name: string; type: "menu" | "text"; enabled: boolean; config: { menuId?: string; content?: string } };
type FormOption = { id: string; name: string; slug: string; status: string; enabled: boolean; _count?: { submissions: number } };

function dimensionLimit(unit: string) {
  return ["%", "vh", "vw"].includes(unit) ? 100 : 1000;
}

function pixelValue(value: string | undefined) {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? `${parsed}px` : undefined;
}

function typographyStyle(block: Pick<Block, "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing" | "fontColor">): CSSProperties {
  const fontSize = pixelValue(block.fontSize);
  const letterSpacing = pixelValue(block.letterSpacing);
  const fontWeight = Number(block.fontWeight);
  const lineHeight = Number(block.lineHeight);
  return {
    ...(fontSize ? { fontSize } : {}),
    ...(Number.isFinite(fontWeight) ? { fontWeight } : {}),
    ...(Number.isFinite(lineHeight) ? { lineHeight } : {}),
    ...(letterSpacing ? { letterSpacing } : {}),
    ...(block.fontColor ? { color: block.fontColor } : {}),
  };
}

const textBlocks: BlockType[] = ["headline", "body", "blockquote", "list", "buttons", "hero", "sidebar", "cta", "news"];
const inspectorRichTextBlocks: BlockType[] = ["body", "hero", "sidebar", "news"];
const liveTitleBlocks: BlockType[] = ["headline", "sidebar", "cta", "news", "form"];

function overlayStyle(block: Pick<Block, "overlayType" | "overlayColor" | "overlaySecondaryColor" | "overlayImage" | "overlayAngle">): CSSProperties {
  if (block.overlayType === "image" && block.overlayImage) return { backgroundImage: `url("${block.overlayImage}")`, backgroundSize: "cover", backgroundPosition: "center" };
  if (block.overlayType === "gradient") return { backgroundImage: `linear-gradient(${block.overlayAngle || "180"}deg, ${block.overlayColor || "#17324d"}, ${block.overlaySecondaryColor || "#e66f51"})` };
  if (block.overlayType === "color") return { backgroundColor: block.overlayColor || "#17324d" };
  return {};
}

function overlayOpacity(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) / 100 : 0.45;
}

type CarouselConfig = { slides: CarouselSlide[]; autoplay: boolean; interval: string; controls: boolean; indicators: boolean };

function carouselConfig(content: string): CarouselConfig {
  try {
    const value = JSON.parse(content) as Partial<CarouselConfig>;
    return {
      slides: Array.isArray(value.slides) ? value.slides : [],
      autoplay: value.autoplay === true,
      interval: typeof value.interval === "string" ? value.interval : "5",
      controls: value.controls !== false,
      indicators: value.indicators !== false,
    };
  } catch {
    return { slides: [], autoplay: false, interval: "5", controls: true, indicators: true };
  }
}

function carouselContent(config: CarouselConfig) {
  return JSON.stringify(config);
}

type ButtonItem = { id: string; label: string; href: string; variant: "primary" | "secondary" | "outline" | "light"; size: "sm" | "md" | "lg"; target: "_self" | "_blank" };
type ButtonsConfig = { items: ButtonItem[]; layout: "row" | "stack"; alignment: "left" | "center" | "right" };

function defaultCtaPanel(index = 0): CtaPanel {
  return { id: `cta-panel-${Date.now()}-${index}`, title: index ? `New CTA ${index + 1}` : "Take the next step", content: "<p>Invite people to take the next step.</p>", buttonLabel: "Learn more", buttonHref: "#", buttonVariant: "primary", buttonSize: "lg", buttonAlignment: "left", buttonTarget: "_self", imageDisplay: "none", imageFit: "cover", imagePosition: "center", imageHoverEffect: "none" };
}

function buttonsConfig(content: string): ButtonsConfig {
  try {
    const value = JSON.parse(content) as Partial<ButtonsConfig>;
    const items: ButtonItem[] = Array.isArray(value.items) ? value.items.filter((item): item is ButtonItem => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.label === "string" && typeof item.href === "string")).map((item) => ({ id: item.id, label: item.label, href: item.href, variant: item.variant === "secondary" || item.variant === "outline" || item.variant === "light" ? item.variant : "primary", size: item.size === "sm" || item.size === "lg" ? item.size : "md", target: item.target === "_blank" ? "_blank" : "_self" })) : [];
    return { items, layout: value.layout === "stack" ? "stack" : "row", alignment: value.alignment === "center" || value.alignment === "right" ? value.alignment : "left" };
  } catch {
    return { items: [], layout: "row", alignment: "left" };
  }
}

function buttonsContent(config: ButtonsConfig) {
  return JSON.stringify(config);
}

function mapEmbedUrl(provider: Block["mapProvider"], address: string | undefined) {
  if (!address) return "";
  const base = provider === "bing" ? "https://www.bing.com/maps?q=" : provider === "openstreetmap" ? "https://www.openstreetmap.org/export/embed.html?query=" : "https://www.google.com/maps?q=";
  return `${base}${encodeURIComponent(address)}${provider === "google" ? "&output=embed" : ""}`;
}

const structuralTypes: BlockType[] = ["container", "flex", "grid"];
const menuBlocks: BlockType[] = ["hero", "sidebar"];
const elementCategories: Array<{ label: string; types: BlockType[] }> = [
  { label: "Layout elements", types: structuralTypes },
  { label: "Text elements", types: ["headline", "body", "blockquote", "list"] },
  { label: "Media elements", types: ["hero", "youtube", "image", "map", "carousel"] },
  { label: "Other elements", types: ["buttons", "table", "calendar", "widget", "cta", "form"] },
];
const initialBlocks: Block[] = [
  { id: "hero-1", type: "hero", title: "", content: "There is room for you here.", mediaType: "image", mediaUrl: "", span: 12 },
  { id: "headline-1", type: "headline", title: "Make space for what matters.", content: "A community learning to live with courage and compassion.", span: 7 }
];

function createBlock(type: BlockType): Block {
  const definition = blockDefinitions[type];
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, title: structuralTypes.includes(type) || type === "hero" || type === "buttons" || type === "cta" || type === "table" || type === "calendar" ? "" : `New ${definition.label.toLowerCase()} element`, content: type === "buttons" ? buttonsContent({ items: [{ id: `button-${Date.now()}`, label: "Learn more", href: "#", variant: "primary", size: "md", target: "_self" }], layout: "row", alignment: "left" }) : type === "table" ? tableConfigContent(defaultTableConfig()) : "", formId: type === "form" ? null : undefined, mediaType: type === "hero" ? "image" : undefined, mediaUrl: type === "hero" ? "" : undefined, imageFit: type === "image" ? "contain" : undefined, imageHoverEffect: type === "image" ? "none" : undefined, imageHoverOverlay: type === "image" ? false : undefined, imageHoverOverlayColor: type === "image" ? "#17324d" : undefined, imageHoverOverlayOpacity: type === "image" ? "45" : undefined, imageHoverText: type === "image" ? "" : undefined, imageLightbox: type === "image" ? false : undefined, imageEnterAnimation: type === "image" ? "none" : undefined, imageExitAnimation: type === "image" ? "none" : undefined, imageAnimationTrigger: type === "image" ? "load" : undefined, youtubeMute: type === "youtube" ? true : undefined, youtubeControls: type === "youtube" ? true : undefined, mapProvider: type === "map" ? "google" : undefined, quoteCitation: type === "blockquote" ? "" : undefined, blockquoteStyle: type === "blockquote" ? "classic" : undefined, listItems: type === "list" ? "" : undefined, listStyle: type === "list" ? "unordered" : undefined, ctaPanels: type === "cta" ? [defaultCtaPanel()] : undefined, ctaColumns: type === "cta" ? 1 : undefined, ctaGap: type === "cta" ? "md" : undefined, ctaAlignment: type === "cta" ? "left" : undefined, ctaPanelStyle: type === "cta" ? "filled" : undefined, headingLevel: type === "headline" ? "h2" : undefined, alignment: "left", backgroundType: "none", overlayType: "none", overlayColor: "#17324d", overlaySecondaryColor: "#e66f51", overlayOpacity: "45", overlayAngle: "180", borderStyle: "none", justify: "left", animation: "none", span: definition.defaultSpan, columns: type === "grid" ? 2 : undefined, flexDirection: type === "flex" ? "row" : undefined, flexWrap: type === "flex" ? "wrap" : undefined, flexGap: type === "flex" ? "16" : undefined, flexJustify: type === "flex" ? "start" : undefined, flexAlign: type === "flex" ? "stretch" : undefined, children: structuralTypes.includes(type) ? [] : undefined };
}

function updateAtPath(blocks: Block[], path: number[], update: (block: Block) => Block): Block[] {
  if (!path.length) return blocks;
  return blocks.map((block, index) => {
    if (index !== path[0]) return block;
    if (path.length === 1) return update(block);
    return { ...block, children: updateAtPath(block.children ?? [], path.slice(1), update) };
  });
}

function removeAtPath(blocks: Block[], path: number[]): Block[] {
  if (path.length === 1) return blocks.filter((_, index) => index !== path[0]);
  return blocks.map((block, index) => index === path[0] ? { ...block, children: removeAtPath(block.children ?? [], path.slice(1)) } : block);
}

function moveChildAtPath(blocks: Block[], parentPath: number[], index: number, direction: -1 | 1): Block[] {
  return updateAtPath(blocks, parentPath, (parent) => {
    const children = [...(parent.children ?? [])];
    const target = index + direction;
    if (target < 0 || target >= children.length) return parent;
    [children[index], children[target]] = [children[target], children[index]];
    return { ...parent, children };
  });
}

function reorderChildrenAtPath(blocks: Block[], parentPath: number[], from: number, to: number): Block[] {
  if (from === to) return blocks;
  const reorder = (children: Block[]) => {
    if (from < 0 || to < 0 || from >= children.length || to >= children.length) return children;
    const next = [...children];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };
  if (!parentPath.length) return reorder(blocks);
  return updateAtPath(blocks, parentPath, (parent) => ({ ...parent, children: reorder(parent.children ?? []) }));
}

function moveBlockToContainer(blocks: Block[], sourcePath: number[], targetPath: number[]) {
  if (!sourcePath.length || !targetPath.length || sourcePath.join(".") === targetPath.join(".") || targetPath.join(".").startsWith(`${sourcePath.join(".")}.`)) return { blocks, path: sourcePath };
  const source = blockAtPath(blocks, sourcePath);
  const target = blockAtPath(blocks, targetPath);
  if (!source || !target || !structuralTypes.includes(target.type)) return { blocks, path: sourcePath };
  const sourceParent = sourcePath.slice(0, -1);
  const targetParent = targetPath.slice(0, -1);
  const next = removeAtPath(blocks, sourcePath);
  const adjustedTargetPath = sourceParent.join(".") === targetParent.join(".") && sourcePath[sourcePath.length - 1] < targetPath[targetPath.length - 1]
    ? [...targetPath.slice(0, -1), targetPath[targetPath.length - 1] - 1]
    : targetPath;
  const targetAfterRemoval = blockAtPath(next, adjustedTargetPath);
  if (!targetAfterRemoval || !structuralTypes.includes(targetAfterRemoval.type)) return { blocks, path: sourcePath };
  const childIndex = targetAfterRemoval.children?.length ?? 0;
  return {
    blocks: updateAtPath(next, adjustedTargetPath, (container) => ({ ...container, children: [...(container.children ?? []), source] })),
    path: [...adjustedTargetPath, childIndex]
  };
}

function cloneBlock(block: Block): Block {
  return { ...block, id: `${block.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, children: block.children?.map(cloneBlock) };
}

function responsiveSettings(block: Block, device: ResponsiveDevice): ResponsiveSettings {
  return device === "desktop" ? {} : block.responsive?.[device] ?? {};
}

function autoLayoutBlocks(blocks: Block[], device: Exclude<ResponsiveDevice, "desktop">): Block[] {
  return blocks.map((block) => {
    const current = block.responsive?.[device] ?? {};
    const recommended: ResponsiveSettings = {
      ...current,
      ...(structuralTypes.includes(block.type) && block.type === "grid" ? { columns: device === "mobile" ? 1 : Math.min(2, block.columns ?? 2) } : {}),
      ...(block.type === "flex" ? { flexDirection: "column", flexWrap: "wrap", flexGap: device === "mobile" ? "12" : "16" } : {}),
      ...(block.type === "cta" ? { columns: device === "mobile" ? 1 : Math.min(2, block.ctaColumns ?? 1) } : {}),
      ...(device === "mobile" && block.padding === "lg" ? { padding: "md" } : {}),
    };
    return {
      ...block,
      responsive: { ...block.responsive, [device]: recommended },
      children: block.children ? autoLayoutBlocks(block.children, device) : block.children,
    };
  });
}

function editorBlockForDevice(block: Block, device: ResponsiveDevice): Block {
  const overrides = responsiveSettings(block, device);
  const definedOverrides = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
  return {
    ...block,
    ...definedOverrides,
    ...(device !== "desktop" && structuralTypes.includes(block.type) && overrides.heightValue === undefined
      ? { heightValue: undefined, heightUnit: undefined }
      : {})
  };
}

function insertAfterPath(blocks: Block[], path: number[], block: Block): Block[] {
  if (!path.length) return [...blocks, block];
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  if (!parentPath.length) return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
  return updateAtPath(blocks, parentPath, (parent) => {
    const children = [...(parent.children ?? [])];
    children.splice(index + 1, 0, block);
    return { ...parent, children };
  });
}

function serialize(block: Block): { id: string; type: BlockType; props: Record<string, unknown> } {
  return { id: block.id, type: block.type, props: { hidden: block.hidden ?? false, title: block.type === "hero" ? "" : block.title, content: block.content, formId: block.formId ?? null, mediaType: block.mediaType ?? null, mediaUrl: block.mediaUrl ?? null, imageUrl: block.imageUrl ?? null, fontColor: block.fontColor ?? null, imageAlt: block.imageAlt ?? null, imageFit: block.imageFit ?? null, imageHoverEffect: block.imageHoverEffect ?? null, imageHoverOverlay: block.imageHoverOverlay ?? false, imageHoverOverlayColor: block.imageHoverOverlayColor ?? null, imageHoverOverlayOpacity: block.imageHoverOverlayOpacity ?? null, imageHoverText: block.imageHoverText ?? null, imageLightbox: block.imageLightbox ?? false, imageEnterAnimation: block.imageEnterAnimation ?? null, imageExitAnimation: block.imageExitAnimation ?? null, imageAnimationTrigger: block.imageAnimationTrigger ?? null, youtubeUrl: block.youtubeUrl ?? null, youtubeStart: block.youtubeStart ?? null, youtubeEnd: block.youtubeEnd ?? null, youtubeAutoplay: block.youtubeAutoplay ?? false, youtubeMute: block.youtubeMute ?? true, youtubeLoop: block.youtubeLoop ?? false, youtubeControls: block.youtubeControls ?? true, mapProvider: block.mapProvider ?? null, mapAddress: block.mapAddress ?? null, mapZoom: block.mapZoom ?? null, quoteCitation: block.quoteCitation ?? null, blockquoteStyle: block.blockquoteStyle ?? null, listItems: block.listItems ?? null, listStyle: block.listStyle ?? null, ctaButtonLabel: block.ctaButtonLabel ?? null, ctaButtonHref: block.ctaButtonHref ?? null, ctaButtonVariant: block.ctaButtonVariant ?? null, ctaButtonTarget: block.ctaButtonTarget ?? null, ctaPanels: block.ctaPanels ?? null, ctaColumns: block.ctaColumns ?? null, ctaGap: block.ctaGap ?? null, ctaAlignment: block.ctaAlignment ?? null, ctaPanelStyle: block.ctaPanelStyle ?? null, headingLevel: block.headingLevel ?? null, fontSize: block.fontSize ?? null, fontWeight: block.fontWeight ?? null, lineHeight: block.lineHeight ?? null, letterSpacing: block.letterSpacing ?? null, alignment: block.alignment ?? null, padding: block.padding ?? null, paddingTop: block.paddingTop ?? null, paddingRight: block.paddingRight ?? null, paddingBottom: block.paddingBottom ?? null, paddingLeft: block.paddingLeft ?? null, backgroundColor: block.backgroundColor ?? null, backgroundTransparent: block.backgroundTransparent ?? false, backgroundType: block.backgroundType ?? null, backgroundUrl: block.backgroundUrl ?? null, overlayHidden: block.overlayHidden ?? false, overlayType: block.overlayType ?? null, overlayColor: block.overlayColor ?? null, overlaySecondaryColor: block.overlaySecondaryColor ?? null, overlayOpacity: block.overlayOpacity ?? null, overlayImage: block.overlayImage ?? null, overlayAngle: block.overlayAngle ?? null, heightValue: block.heightValue ?? null, heightUnit: block.heightUnit ?? null, widthValue: block.widthValue ?? null, widthUnit: block.widthUnit ?? null, margin: block.margin ?? null, marginTop: block.marginTop ?? null, marginRight: block.marginRight ?? null, marginBottom: block.marginBottom ?? null, marginLeft: block.marginLeft ?? null, borderRadius: block.borderRadius ?? null, borderWidth: block.borderWidth ?? null, borderColor: block.borderColor ?? null, borderStyle: block.borderStyle ?? null, justify: block.justify ?? null, verticalAlign: block.verticalAlign ?? null, flexDirection: block.flexDirection ?? null, flexWrap: block.flexWrap ?? null, flexGap: block.flexGap ?? null, flexJustify: block.flexJustify ?? null, flexAlign: block.flexAlign ?? null, videoControls: block.videoControls ?? false, videoAutoplay: block.videoAutoplay ?? false, videoLoop: block.videoLoop ?? false, videoMuted: block.videoMuted ?? true, span: block.span, menuId: block.menuId ?? null, menuLocationId: block.menuLocationId ?? null, menuStyle: block.menuStyle ?? null, widgetId: block.widgetId ?? null, columns: block.columns ?? null, responsive: block.responsive ?? null, children: block.children?.map(serialize) ?? [] } };
}

function hydrateResponsive(value: unknown): ResponsiveOverrides | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const read = (candidate: unknown): ResponsiveSettings | undefined => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
    const item = candidate as Record<string, unknown>;
    return {
      hidden: typeof item.hidden === "boolean" ? item.hidden : undefined,
      backgroundHidden: typeof item.backgroundHidden === "boolean" ? item.backgroundHidden : undefined,
      backgroundType: item.backgroundType === "color" || item.backgroundType === "image" || item.backgroundType === "video" ? item.backgroundType : undefined,
      backgroundColor: typeof item.backgroundColor === "string" ? item.backgroundColor : undefined,
      backgroundUrl: typeof item.backgroundUrl === "string" ? item.backgroundUrl : undefined,
      title: typeof item.title === "string" ? item.title : undefined,
      content: typeof item.content === "string" ? item.content : undefined,
      quoteCitation: typeof item.quoteCitation === "string" ? item.quoteCitation : undefined,
      listItems: typeof item.listItems === "string" ? item.listItems : undefined,
      ctaButtonLabel: typeof item.ctaButtonLabel === "string" ? item.ctaButtonLabel : undefined,
      ctaButtonHref: typeof item.ctaButtonHref === "string" ? item.ctaButtonHref : undefined,
      ctaButtonVariant: item.ctaButtonVariant === "secondary" || item.ctaButtonVariant === "outline" || item.ctaButtonVariant === "light" ? item.ctaButtonVariant : item.ctaButtonVariant === "primary" ? "primary" : undefined,
      ctaButtonTarget: item.ctaButtonTarget === "_blank" ? "_blank" : item.ctaButtonTarget === "_self" ? "_self" : undefined,
      fontSize: typeof item.fontSize === "string" ? item.fontSize : undefined,
      fontColor: typeof item.fontColor === "string" ? item.fontColor : undefined,
      fontWeight: typeof item.fontWeight === "string" ? item.fontWeight : undefined,
      lineHeight: typeof item.lineHeight === "string" ? item.lineHeight : undefined,
      letterSpacing: typeof item.letterSpacing === "string" ? item.letterSpacing : undefined,
      alignment: item.alignment === "center" || item.alignment === "right" ? item.alignment : item.alignment === "left" ? "left" : undefined,
      padding: item.padding === "none" || item.padding === "sm" || item.padding === "md" || item.padding === "lg" ? item.padding : undefined,
      paddingTop: typeof item.paddingTop === "string" ? item.paddingTop : undefined,
      paddingRight: typeof item.paddingRight === "string" ? item.paddingRight : undefined,
      paddingBottom: typeof item.paddingBottom === "string" ? item.paddingBottom : undefined,
      paddingLeft: typeof item.paddingLeft === "string" ? item.paddingLeft : undefined,
      widthValue: typeof item.widthValue === "string" ? item.widthValue : undefined,
      widthUnit: ["%", "px", "em", "vh", "vw", "full"].includes(String(item.widthUnit)) ? item.widthUnit as Block["widthUnit"] : undefined,
      heightValue: typeof item.heightValue === "string" ? item.heightValue : undefined,
      heightUnit: ["%", "px", "em", "vh", "vw"].includes(String(item.heightUnit)) ? item.heightUnit as Block["heightUnit"] : undefined,
      marginTop: typeof item.marginTop === "string" ? item.marginTop : undefined,
      marginRight: typeof item.marginRight === "string" ? item.marginRight : undefined,
      marginBottom: typeof item.marginBottom === "string" ? item.marginBottom : undefined,
      marginLeft: typeof item.marginLeft === "string" ? item.marginLeft : undefined,
      justify: item.justify === "center" || item.justify === "right" ? item.justify : item.justify === "left" ? "left" : undefined,
      verticalAlign: item.verticalAlign === "center" || item.verticalAlign === "bottom" ? item.verticalAlign : item.verticalAlign === "top" ? "top" : undefined,
      flexDirection: item.flexDirection === "column" || item.flexDirection === "row" ? item.flexDirection : undefined,
      flexWrap: item.flexWrap === "nowrap" || item.flexWrap === "wrap" ? item.flexWrap : undefined,
      flexGap: typeof item.flexGap === "string" ? item.flexGap : undefined,
      flexJustify: ["start", "center", "end", "between", "around"].includes(String(item.flexJustify)) ? item.flexJustify as Block["flexJustify"] : undefined,
      flexAlign: ["start", "center", "end", "stretch"].includes(String(item.flexAlign)) ? item.flexAlign as Block["flexAlign"] : undefined,
      overlayHidden: typeof item.overlayHidden === "boolean" ? item.overlayHidden : undefined,
      columns: typeof item.columns === "number" && item.columns >= 1 && item.columns <= 12 ? Math.round(item.columns) : undefined,
    };
  };
  const tablet = read(source.tablet);
  const mobile = read(source.mobile);
  return tablet || mobile ? { tablet, mobile } : undefined;
}

function hydrateBlock(value: { id: string; type: BlockType; props: Record<string, unknown> }): Block | null {
  if (!(value.type in blockDefinitions)) return null;
  const props = value.props;
  const children = Array.isArray(props.children) ? props.children.flatMap((child) => {
    if (!child || typeof child !== "object") return [];
    const nested = child as { id?: unknown; type?: unknown; props?: unknown };
    if (typeof nested.id !== "string" || typeof nested.type !== "string" || !nested.props || typeof nested.props !== "object" || Array.isArray(nested.props)) return [];
    const hydrated = hydrateBlock({ id: nested.id, type: nested.type as BlockType, props: nested.props as Record<string, unknown> });
    return hydrated ? [hydrated] : [];
  }) : undefined;
  return { id: value.id, type: value.type, hidden: props.hidden === true, title: value.type === "hero" ? "" : typeof props.title === "string" ? props.title : "", content: typeof props.content === "string" ? props.content : "", formId: typeof props.formId === "string" ? props.formId : null, mediaType: props.mediaType === "video" ? "video" : props.mediaType === "image" ? "image" : undefined, mediaUrl: typeof props.mediaUrl === "string" ? props.mediaUrl : undefined, imageUrl: typeof props.imageUrl === "string" ? props.imageUrl : undefined, imageAlt: typeof props.imageAlt === "string" ? props.imageAlt : undefined, imageFit: props.imageFit === "cover" || props.imageFit === "fill" ? props.imageFit : value.type === "image" ? "contain" : undefined, imageHoverEffect: props.imageHoverEffect === "zoom" || props.imageHoverEffect === "lift" || props.imageHoverEffect === "grayscale" ? props.imageHoverEffect : "none", imageHoverOverlay: props.imageHoverOverlay === true, imageHoverOverlayColor: typeof props.imageHoverOverlayColor === "string" ? props.imageHoverOverlayColor : "#17324d", imageHoverOverlayOpacity: typeof props.imageHoverOverlayOpacity === "string" ? props.imageHoverOverlayOpacity : "45", imageHoverText: typeof props.imageHoverText === "string" ? props.imageHoverText : "", imageLightbox: props.imageLightbox === true, imageEnterAnimation: props.imageEnterAnimation === "fade" || props.imageEnterAnimation === "slide-up" || props.imageEnterAnimation === "slide-left" || props.imageEnterAnimation === "zoom" ? props.imageEnterAnimation : "none", imageExitAnimation: props.imageExitAnimation === "fade" || props.imageExitAnimation === "slide-down" || props.imageExitAnimation === "slide-right" || props.imageExitAnimation === "zoom-out" ? props.imageExitAnimation : "none", imageAnimationTrigger: props.imageAnimationTrigger === "viewport" ? "viewport" : "load", youtubeUrl: typeof props.youtubeUrl === "string" ? props.youtubeUrl : undefined, youtubeStart: typeof props.youtubeStart === "string" ? props.youtubeStart : undefined, youtubeEnd: typeof props.youtubeEnd === "string" ? props.youtubeEnd : undefined, youtubeAutoplay: props.youtubeAutoplay === true, youtubeMute: props.youtubeMute !== false, youtubeLoop: props.youtubeLoop === true, youtubeControls: props.youtubeControls !== false, mapProvider: props.mapProvider === "bing" || props.mapProvider === "openstreetmap" ? props.mapProvider : "google", mapAddress: typeof props.mapAddress === "string" ? props.mapAddress : undefined, mapZoom: typeof props.mapZoom === "string" ? props.mapZoom : undefined, quoteCitation: typeof props.quoteCitation === "string" ? props.quoteCitation : undefined, blockquoteStyle: props.blockquoteStyle === "centered" || props.blockquoteStyle === "boxed" || props.blockquoteStyle === "quotation" || props.blockquoteStyle === "minimal" ? props.blockquoteStyle : "classic", listItems: typeof props.listItems === "string" ? props.listItems : undefined, ctaButtonLabel: typeof props.ctaButtonLabel === "string" ? props.ctaButtonLabel : value.type === "cta" ? "Learn more" : undefined, ctaButtonHref: typeof props.ctaButtonHref === "string" ? props.ctaButtonHref : value.type === "cta" ? "#" : undefined, ctaButtonVariant: props.ctaButtonVariant === "secondary" || props.ctaButtonVariant === "outline" || props.ctaButtonVariant === "light" ? props.ctaButtonVariant : "primary", ctaButtonTarget: props.ctaButtonTarget === "_blank" ? "_blank" : "_self",   ctaPanels: Array.isArray(props.ctaPanels) ? props.ctaPanels.filter((panel): panel is CtaPanel => Boolean(panel && typeof panel === "object" && typeof (panel as Record<string, unknown>).id === "string")).map((panel) => panel as CtaPanel) : value.type === "cta" ? [{ id: `legacy-${value.id}`, title: typeof props.title === "string" && props.title ? props.title : "Take the next step", content: typeof props.content === "string" && props.content ? props.content : "<p>Invite people to take the next step.</p>", buttonLabel: typeof props.ctaButtonLabel === "string" && props.ctaButtonLabel ? props.ctaButtonLabel : "Learn more", buttonHref: typeof props.ctaButtonHref === "string" && props.ctaButtonHref ? props.ctaButtonHref : "#", buttonVariant: props.ctaButtonVariant === "secondary" || props.ctaButtonVariant === "outline" || props.ctaButtonVariant === "light" ? props.ctaButtonVariant : "primary",   buttonTarget: props.ctaButtonTarget === "_blank" ? "_blank" : "_self", buttonSize: "lg", buttonAlignment: "left" }] : undefined, ctaColumns: props.ctaColumns === 2 || props.ctaColumns === 3 || props.ctaColumns === 4 || props.ctaColumns === 5 ? props.ctaColumns : value.type === "cta" ? 1 : undefined, ctaGap: props.ctaGap === "sm" || props.ctaGap === "lg" ? props.ctaGap : value.type === "cta" ? "md" : undefined, ctaAlignment: props.ctaAlignment === "center" || props.ctaAlignment === "right" ? props.ctaAlignment : "left", ctaPanelStyle: props.ctaPanelStyle === "outlined" || props.ctaPanelStyle === "minimal" ? props.ctaPanelStyle : "filled", listStyle: props.listStyle === "ordered" ? "ordered" : "unordered", headingLevel: typeof props.headingLevel === "string" && /^h[1-6]$/.test(props.headingLevel) ? props.headingLevel as Block["headingLevel"] : value.type === "headline" ? "h2" : undefined, fontSize: typeof props.fontSize === "string" ? props.fontSize : undefined, fontColor: typeof props.fontColor === "string" ? props.fontColor : undefined, fontWeight: typeof props.fontWeight === "string" ? props.fontWeight : undefined, lineHeight: typeof props.lineHeight === "string" ? props.lineHeight : undefined, letterSpacing: typeof props.letterSpacing === "string" ? props.letterSpacing : undefined, alignment: props.alignment === "center" || props.alignment === "right" ? props.alignment : "left", padding: props.padding === "none" || props.padding === "sm" || props.padding === "lg" ? props.padding : "md", paddingTop: typeof props.paddingTop === "string" ? props.paddingTop : undefined, paddingRight: typeof props.paddingRight === "string" ? props.paddingRight : undefined, paddingBottom: typeof props.paddingBottom === "string" ? props.paddingBottom : undefined, paddingLeft: typeof props.paddingLeft === "string" ? props.paddingLeft : undefined, backgroundColor: typeof props.backgroundColor === "string" ? props.backgroundColor : undefined, backgroundTransparent: props.backgroundTransparent === true, backgroundType: props.backgroundType === "color" || props.backgroundType === "image" || props.backgroundType === "video" ? props.backgroundType : "none", backgroundUrl: typeof props.backgroundUrl === "string" ? props.backgroundUrl : undefined, overlayHidden: props.overlayHidden === true, overlayType: props.overlayType === "color" || props.overlayType === "gradient" || props.overlayType === "image" ? props.overlayType : "none", overlayColor: typeof props.overlayColor === "string" ? props.overlayColor : undefined, overlaySecondaryColor: typeof props.overlaySecondaryColor === "string" ? props.overlaySecondaryColor : undefined, overlayOpacity: typeof props.overlayOpacity === "string" ? props.overlayOpacity : undefined, overlayImage: typeof props.overlayImage === "string" ? props.overlayImage : undefined, overlayAngle: typeof props.overlayAngle === "string" ? props.overlayAngle : undefined, heightValue: typeof props.heightValue === "string" ? props.heightValue : undefined, heightUnit: ["%", "px", "em", "vh", "vw"].includes(String(props.heightUnit)) ? props.heightUnit as Block["heightUnit"] : undefined, widthValue: typeof props.widthValue === "string" ? props.widthValue : undefined, widthUnit: ["%", "px", "em", "vh", "vw", "full"].includes(String(props.widthUnit)) ? props.widthUnit as Block["widthUnit"] : undefined, margin: typeof props.margin === "string" ? props.margin : undefined, marginTop: typeof props.marginTop === "string" ? props.marginTop : undefined, marginRight: typeof props.marginRight === "string" ? props.marginRight : undefined, marginBottom: typeof props.marginBottom === "string" ? props.marginBottom : undefined, marginLeft: typeof props.marginLeft === "string" ? props.marginLeft : undefined, borderRadius: typeof props.borderRadius === "string" ? props.borderRadius : undefined, borderWidth: typeof props.borderWidth === "string" ? props.borderWidth : undefined, borderColor: typeof props.borderColor === "string" ? props.borderColor : undefined, borderStyle: props.borderStyle === "solid" || props.borderStyle === "dashed" || props.borderStyle === "dotted" ? props.borderStyle : "none", justify: props.justify === "center" || props.justify === "right" ? props.justify : "left", verticalAlign: props.verticalAlign === "center" || props.verticalAlign === "bottom" ? props.verticalAlign : "top", flexDirection: props.flexDirection === "column" ? "column" : "row", flexWrap: props.flexWrap === "nowrap" ? "nowrap" : "wrap", flexGap: typeof props.flexGap === "string" ? props.flexGap : "16", flexJustify: ["center", "end", "between", "around"].includes(String(props.flexJustify)) ? props.flexJustify as Block["flexJustify"] : "start", flexAlign: ["start", "center", "end", "stretch"].includes(String(props.flexAlign)) ? props.flexAlign as Block["flexAlign"] : "stretch", videoControls: props.videoControls === true, videoAutoplay: props.videoAutoplay === true, videoLoop: props.videoLoop === true, videoMuted: props.videoMuted !== false,   animation: ["fade-in", "slide-up", "slide-left", "zoom-in"].includes(String(props.animation)) ? props.animation as Block["animation"] : "none", span: typeof props.span === "number" ? props.span : 12, menuId: typeof props.menuId === "string" ? props.menuId : null, menuLocationId: typeof props.menuLocationId === "string" ? props.menuLocationId : null, menuStyle: props.menuStyle === "large-buttons" ? "large-buttons" : props.menuStyle === "small-buttons" ? "small-buttons" : props.menuStyle === "buttons" ? "buttons" : "links", widgetId: typeof props.widgetId === "string" ? props.widgetId : null, columns: typeof props.columns === "number" && props.columns >= 1 && props.columns <= 12 ? Math.round(props.columns) : undefined, responsive: hydrateResponsive(props.responsive), children };
}

export function RichTextField({ value, onChange, style, toolbarExtras }: { value: string; onChange: (value: string) => void; style?: CSSProperties; toolbarExtras?: (insertHtml: (html: string) => void) => ReactNode }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [htmlView, setHtmlView] = useState(false);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number; table: HTMLTableElement } | null>(null);
  useLayoutEffect(() => {
    if (htmlView) {
      if (htmlRef.current) {
        htmlRef.current.style.height = "auto";
        htmlRef.current.style.height = `${htmlRef.current.scrollHeight}px`;
      }
    } else if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value, htmlView]);
  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current || !selection.anchorNode || !selection.focusNode) return;
    if (editorRef.current.contains(selection.anchorNode) && editorRef.current.contains(selection.focusNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    if (!selectionRef.current || !editorRef.current) return;
    const { commonAncestorContainer } = selectionRef.current;
    if (!editorRef.current.contains(commonAncestorContainer)) return;
    editorRef.current.focus({ preventScroll: true });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(selectionRef.current);
  };
  useEffect(() => {
    const handleSelectionChange = () => saveSelection();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);
  useEffect(() => {
    const closeTableMenu = (event: globalThis.MouseEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("[data-table-menu]")) return;
      setTableMenu(null);
    };
    document.addEventListener("mousedown", closeTableMenu);
    return () => document.removeEventListener("mousedown", closeTableMenu);
  }, []);
  const apply = (command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  const applyFontSize = (size: string) => {
    restoreSelection();
    document.execCommand("fontSize", false, "7");
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = `${size}px`;
      while (font.firstChild) span.appendChild(font.firstChild);
      font.replaceWith(span);
    });
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  const insertHtml = (html: string) => {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  const insertLink = () => {
    const url = window.prompt("Link URL");
    if (!url) return;
    const target = window.prompt("Open link in _blank or _self?", "_self") === "_blank" ? "_blank" : "_self";
    insertHtml(`<a href="${url.replace(/"/g, "&quot;")}" target="${target}" rel="${target === "_blank" ? "noopener noreferrer" : ""}">${window.getSelection()?.toString() || url}</a>`);
  };
  const insertTable = () => {
    const rows = Math.max(1, Math.min(20, Number(window.prompt("Number of rows", "2")) || 2));
    const columns = Math.max(1, Math.min(10, Number(window.prompt("Number of columns", "2")) || 2));
    const body = Array.from({ length: rows }, () => `<tr>${Array.from({ length: columns }, () => "<td>Text</td>").join("")}</tr>`).join("");
    insertHtml(`<table><tbody>${body}</tbody></table><p><br></p>`);
  };
  const updateTable = (update: (table: HTMLTableElement) => void) => {
    if (!tableMenu || !editorRef.current) return;
    update(tableMenu.table);
    onChange(editorRef.current.innerHTML);
    setTableMenu(null);
  };
  const addTableRow = () => updateTable((table) => {
    const body = table.tBodies[0] ?? table.createTBody();
    const columnCount = body.rows[0]?.cells.length ?? 1;
    const row = body.insertRow();
    for (let index = 0; index < columnCount; index += 1) row.insertCell().textContent = "Text";
  });
  const addTableColumn = () => updateTable((table) => {
    const body = table.tBodies[0] ?? table.createTBody();
    Array.from(body.rows).forEach((row) => { row.insertCell().textContent = "Text"; });
  });
  const toggleTableBorders = () => updateTable((table) => {
    table.dataset.editorBorders = table.dataset.editorBorders === "hidden" ? "visible" : "hidden";
  });
  const deleteTable = () => updateTable((table) => table.remove());
  const fontOptions = ["Inter", "Lora", "Roboto", "Open Sans", "Montserrat", "Merriweather", "Poppins", "Playfair Display"];
  const standardTextColors = [
    ["Ink", "#17324d"],
    ["Black", "#000000"],
    ["Dark gray", "#4b5563"],
    ["Gray", "#6b7280"],
    ["White", "#ffffff"],
    ["Coral", "#e66f51"],
    ["Blue", "#2563eb"],
    ["Green", "#15803d"],
  ] as const;
  const emojis = ["😀", "😊", "😂", "😍", "🙏", "❤️", "🎉", "✨", "👍", "👏", "🌟", "☀️"];
  const symbols = ["©", "®", "™", "§", "†", "‡", "•", "→", "←", "★", "✓", "∞"];
  return <div className="mt-3 min-w-0 overflow-hidden rounded-lg border border-ink/10 bg-white">
    <div className="flex flex-wrap gap-1 rounded-t-lg border-b border-ink/15 bg-mist/60 p-2 shadow-[inset_0_-1px_0_rgb(23_50_77_/_0.04)]" onMouseDownCapture={saveSelection}>
      {([["bold", "bold", "Bold"], ["italic", "italic", "Italic"], ["underline", "underline", "Underline"], ["strikeThrough", "strike", "Strikethrough"], ["insertUnorderedList", "unordered", "Bulleted list"], ["insertOrderedList", "ordered", "Numbered list"], ["justifyLeft", "left", "Align left"], ["justifyCenter", "center", "Align center"], ["justifyRight", "right", "Align right"], ["removeFormat", "clear", "Clear formatting"]] as const).map(([command, icon, label]) => <button key={command} type="button" aria-label={label} title={label} className="focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-mist" onMouseDown={(event) => { event.preventDefault(); apply(command); }}><ToolbarIcon name={icon} /></button>)}
      <select aria-label="Text style" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onMouseDownCapture={saveSelection} onChange={(event) => { if (event.target.value) apply("formatBlock", event.target.value); event.target.value = ""; }}><option value="">Style</option><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option><option value="h5">Heading 5</option><option value="h6">Heading 6</option><option value="blockquote">Quote</option></select>
      <select aria-label="Font size" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onMouseDownCapture={saveSelection} onChange={(event) => { if (event.target.value) applyFontSize(event.target.value); event.target.value = ""; }}><option value="">Size</option>{Array.from({ length: 65 }, (_, index) => index + 8).map((size) => <option key={size} value={size}>{size}px</option>)}</select>
      <select aria-label="Google font" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onChange={(event) => { if (event.target.value) { const family = event.target.value; const linkId = `font-${family.replace(/\W/g, "-")}`; if (!document.getElementById(linkId)) { const link = document.createElement("link"); link.id = linkId; link.rel = "stylesheet"; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;600;700&display=swap`; document.head.appendChild(link); } apply("fontName", family); } }}><option value="">Font</option>{fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}</select>
      <select aria-label="Preset font color" title="Preset font color" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onMouseDownCapture={saveSelection} onChange={(event) => { if (event.target.value) apply("foreColor", event.target.value); event.target.value = ""; }}><option value="">Color</option>{standardTextColors.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select>
      <label className="flex items-center rounded border border-ink/15 px-1 text-xs" title="Custom font color"><span className="mr-1">A</span><input aria-label="Custom font color" type="color" className="h-5 w-5 border-0 p-0" defaultValue="#17324d" onChange={(event) => apply("foreColor", event.target.value)} /></label>
      <button type="button" aria-label="Insert link" title="Insert link" className="focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-mist" onMouseDown={(event) => { event.preventDefault(); insertLink(); }}><ToolbarIcon name="link" /></button>
      <select aria-label="Insert emoji" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onChange={(event) => { if (event.target.value) insertHtml(event.target.value); event.target.value = ""; }}><option value="">Emoji</option>{emojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select>
      <select aria-label="Insert symbol" className="focus-ring max-w-full rounded border border-ink/15 px-1 py-1 text-xs" defaultValue="" onChange={(event) => { if (event.target.value) insertHtml(event.target.value); event.target.value = ""; }}><option value="">Symbol</option>{symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}</select>
      <button type="button" aria-label="Insert table" title="Insert table" className="focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-mist" onMouseDown={(event) => { event.preventDefault(); insertTable(); }}><ToolbarIcon name="table" /></button>
      {toolbarExtras?.(insertHtml)}
      <button type="button" aria-label={htmlView ? "Switch to visual editor" : "View HTML source"} title={htmlView ? "Switch to visual editor" : "View HTML source"} className="focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-mist" aria-pressed={htmlView} onClick={() => setHtmlView((current) => !current)}><ToolbarIcon name="html" /></button>
    </div>
    {htmlView ? <textarea ref={htmlRef} aria-label="HTML source" className="min-h-72 w-full resize-none overflow-hidden px-3 py-2 font-mono text-xs leading-5 text-ink outline-none" style={style} value={value} onChange={(event) => onChange(event.target.value)} /> : <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Text content" className="rich-text-editor min-h-72 px-3 py-2 text-sm leading-6 text-ink/70 outline-none" style={style} onInput={(event) => onChange(event.currentTarget.innerHTML)} onMouseUp={saveSelection} onKeyUp={saveSelection} onContextMenu={(event) => { const table = (event.target as HTMLElement).closest("table"); if (!table) return; event.preventDefault(); event.stopPropagation(); setTableMenu({ x: event.clientX, y: event.clientY, table }); }} />}
    {tableMenu && <div data-table-menu role="menu" aria-label="Table options" className="fixed z-50 grid min-w-44 gap-1 rounded-lg border border-ink/15 bg-white p-1 text-xs shadow-lg" style={{ left: tableMenu.x, top: tableMenu.y }} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={addTableRow}>Add row</button><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={addTableColumn}>Add column</button><button type="button" className="rounded px-3 py-2 text-left hover:bg-mist" onClick={toggleTableBorders}>{tableMenu.table.dataset.editorBorders === "hidden" ? "Show reference borders" : "Hide reference borders"}</button><button type="button" className="rounded px-3 py-2 text-left text-coral hover:bg-mist" onClick={deleteTable}>Delete table</button></div>}
  </div>;
}

function blockAtPath(blocks: Block[], path: number[]): Block | null {
  let current: Block | undefined = blocks[path[0]];
  for (const index of path.slice(1)) current = current?.children?.[index];
  return current ?? null;
}

function CarouselInspector({ block, path, previewDevice, onUpdate }: { block: Block; path: number[]; previewDevice: ResponsiveDevice; onUpdate: (path: number[], changes: Partial<Block>) => void }) {
  const config = carouselConfig(block.content);
  const update = (changes: Partial<CarouselConfig>) => onUpdate(path, { content: carouselContent({ ...config, ...changes }) });
  const updateSlide = (id: string, changes: Partial<CarouselSlide>) => update({ slides: config.slides.map((slide) => slide.id === id ? { ...slide, ...changes } : slide) });
  const addSlide = () => update({ slides: [...config.slides, { id: `slide-${Date.now()}`, mediaType: "image", imageUrl: "", videoUrl: "", alt: "", caption: "", linkUrl: "" }] });
  const removeSlide = (id: string) => update({ slides: config.slides.filter((slide) => slide.id !== id) });
  return <div className="grid min-w-0 gap-3 rounded-lg border border-ink/10 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Carousel settings</span>{previewDevice !== "desktop" && <p className="rounded bg-coral/10 px-2 py-1 text-xs text-coral">Editing the {previewDevice} carousel configuration.</p>}<label className="flex items-center justify-between gap-3 text-xs text-ink/60">Autoplay<input type="checkbox" checked={config.autoplay} onChange={(event) => update({ autoplay: event.target.checked })} /></label><label className="grid gap-1 text-xs text-ink/60">Interval (seconds)<input type="number" min="1" max="120" className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.interval} onChange={(event) => update({ interval: event.target.value })} /></label><label className="flex items-center justify-between gap-3 text-xs text-ink/60">Arrows<input type="checkbox" checked={config.controls} onChange={(event) => update({ controls: event.target.checked })} /></label><label className="flex items-center justify-between gap-3 text-xs text-ink/60">Indicators<input type="checkbox" checked={config.indicators} onChange={(event) => update({ indicators: event.target.checked })} /></label><div className="grid gap-3">{config.slides.map((slide, index) => <div key={slide.id} className="grid gap-2 rounded border border-ink/10 p-2"><div className="flex items-center justify-between text-xs font-semibold text-ink/60"><span>Slide {index + 1}</span><button type="button" className="text-coral" onClick={() => removeSlide(slide.id)}>Remove</button></div><select className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={slide.mediaType} onChange={(event) => updateSlide(slide.id, { mediaType: event.target.value as CarouselSlide["mediaType"] })}><option value="image">Image</option><option value="video">Video</option></select>{slide.mediaType === "video" ? <MediaPicker label="Choose video" mediaType="video" value={slide.videoUrl} onSelect={(asset) => updateSlide(slide.id, { videoUrl: asset.url })} onSelectUrl={(url) => updateSlide(slide.id, { videoUrl: url })} /> : <MediaPicker label="Choose image" value={slide.imageUrl} onSelect={(asset) => updateSlide(slide.id, { imageUrl: asset.url, alt: asset.altText ?? slide.alt })} />}<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" placeholder="Alt text" value={slide.alt} onChange={(event) => updateSlide(slide.id, { alt: event.target.value })} /><input className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" placeholder="Caption (optional)" value={slide.caption} onChange={(event) => updateSlide(slide.id, { caption: event.target.value })} /><input className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" placeholder="Link URL (optional)" value={slide.linkUrl} onChange={(event) => updateSlide(slide.id, { linkUrl: event.target.value })} /></div>)}</div><button type="button" className="focus-ring rounded border border-coral px-3 py-2 text-xs font-semibold text-coral" onClick={addSlide}>Add slide</button></div>;
}

function ButtonsInspector({ block, path, previewDevice, onUpdate }: { block: Block; path: number[]; previewDevice: ResponsiveDevice; onUpdate: (path: number[], changes: Partial<Block>) => void }) {
  const config = buttonsConfig(block.content);
  const update = (changes: Partial<ButtonsConfig>) => onUpdate(path, { content: buttonsContent({ ...config, ...changes }) });
  const updateItem = (id: string, changes: Partial<ButtonItem>) => update({ items: config.items.map((item) => item.id === id ? { ...item, ...changes } : item) });
  const addItem = () => update({ items: [...config.items, { id: `button-${Date.now()}`, label: "New button", href: "#", variant: "primary", size: "md", target: "_self" }] });
  const removeItem = (id: string) => update({ items: config.items.filter((item) => item.id !== id) });
  return <div className="grid gap-3 rounded-lg border border-ink/10 p-3">
    <span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Button settings</span>
    {previewDevice !== "desktop" && <p className="rounded bg-coral/10 px-2 py-1 text-xs text-coral">Editing the {previewDevice} button configuration.</p>}
    <div className="grid grid-cols-2 gap-2">
      <label className="grid gap-1 text-xs text-ink/60">Layout<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.layout} onChange={(event) => update({ layout: event.target.value as ButtonsConfig["layout"] })}><option value="row">Row</option><option value="stack">Stack</option></select></label>
      <label className="grid gap-1 text-xs text-ink/60">Alignment<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.alignment} onChange={(event) => update({ alignment: event.target.value as ButtonsConfig["alignment"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
    </div>
    <div className="grid gap-3">{config.items.map((item, index) => <div key={item.id} className="grid gap-2 rounded border border-ink/10 p-2">
      <div className="flex items-center justify-between text-xs font-semibold text-ink/60"><span>Button {index + 1}</span><button type="button" className="text-coral" onClick={() => removeItem(item.id)}>Remove</button></div>
      <input className="focus-ring rounded border border-ink/15 px-2 py-1 text-sm text-ink" placeholder="Button label" value={item.label} onChange={(event) => updateItem(item.id, { label: event.target.value })} />
      <input className="focus-ring rounded border border-ink/15 px-2 py-1 text-sm text-ink" placeholder="Link or anchor, e.g. /visit or #contact" value={item.href} onChange={(event) => updateItem(item.id, { href: event.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <select aria-label={`Button ${index + 1} style`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={item.variant} onChange={(event) => updateItem(item.id, { variant: event.target.value as ButtonItem["variant"] })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="outline">Outline</option><option value="light">Light</option></select>
        <select aria-label={`Button ${index + 1} size`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={item.size} onChange={(event) => updateItem(item.id, { size: event.target.value as ButtonItem["size"] })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select>
        <select aria-label={`Button ${index + 1} target`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={item.target} onChange={(event) => updateItem(item.id, { target: event.target.value as ButtonItem["target"] })}><option value="_self">Same tab</option><option value="_blank">New tab</option></select>
      </div>
    </div>)}</div>
    <button type="button" className="focus-ring rounded border border-coral px-3 py-2 text-xs font-semibold text-coral" onClick={addItem}>Add button</button>
  </div>;
}

function TableInspector({ block, path, previewDevice, onUpdate }: { block: Block; path: number[]; previewDevice: ResponsiveDevice; onUpdate: (path: number[], changes: Partial<Block>) => void }) {
  const config = parseTableConfig(block.content);
  const update = (changes: Partial<TableConfig>) => onUpdate(path, { content: tableConfigContent({ ...config, ...changes }) });
  const updateColumn = (id: string, changes: Partial<TableConfig["columns"][number]>) => update({ columns: config.columns.map((column) => column.id === id ? { ...column, ...changes } : column) });
  const updateCell = (rowId: string, columnIndex: number, value: string) => update({ rows: config.rows.map((row) => row.id === rowId ? { ...row, cells: row.cells.map((cell, index) => index === columnIndex ? value : cell) } : row) });
  const addColumn = () => {
    const index = config.columns.length + 1;
    update({ columns: [...config.columns, { id: `table-column-${Date.now()}`, header: `Column ${index}`, align: "left" }], rows: config.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })) });
  };
  const removeColumn = (id: string) => {
    if (config.columns.length <= 1) return;
    const index = config.columns.findIndex((column) => column.id === id);
    update({ columns: config.columns.filter((column) => column.id !== id), rows: config.rows.map((row) => ({ ...row, cells: row.cells.filter((_, cellIndex) => cellIndex !== index) })) });
  };
  const addRow = () => update({ rows: [...config.rows, { id: `table-row-${Date.now()}`, cells: config.columns.map(() => "") }] });
  const removeRow = (id: string) => { if (config.rows.length > 1) update({ rows: config.rows.filter((row) => row.id !== id) }); };
  return <div className="grid gap-3 rounded-lg border border-ink/10 p-3">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Table settings</span>{previewDevice !== "desktop" && <span className="rounded bg-coral/10 px-2 py-1 text-[10px] font-semibold text-coral">{previewDevice}</span>}</div>
    <label className="grid gap-1 text-xs text-ink/60">Caption / title (optional)<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.caption} onChange={(event) => update({ caption: event.target.value })} placeholder="Schedule or table title" /></label>
    <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Alignment<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.alignment} onChange={(event) => update({ alignment: event.target.value as TableConfig["alignment"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label className="grid gap-1 text-xs text-ink/60">Spacing<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.spacing} onChange={(event) => update({ spacing: event.target.value as TableConfig["spacing"] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div>
    <div className="grid gap-2"><label className="flex items-center justify-between gap-3 text-xs text-ink/60">Header row<input type="checkbox" checked={config.headerRow} onChange={(event) => update({ headerRow: event.target.checked })} /></label><label className="flex items-center justify-between gap-3 text-xs text-ink/60">Striped rows<input type="checkbox" checked={config.striped} onChange={(event) => update({ striped: event.target.checked })} /></label><label className="flex items-center justify-between gap-3 text-xs text-ink/60">Horizontal scroll on small screens<input type="checkbox" checked={config.responsive} onChange={(event) => update({ responsive: event.target.checked })} /></label></div>
    <div className="grid gap-3">
      {config.columns.map((column, columnIndex) => <div key={column.id} className="grid gap-2 rounded border border-ink/10 p-2">
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink/60">Column {columnIndex + 1}</span><button type="button" className="text-xs font-semibold text-coral disabled:opacity-40" disabled={config.columns.length <= 1} onClick={() => removeColumn(column.id)}>Remove</button></div>
        <input aria-label={`Column ${columnIndex + 1} header`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-sm text-ink" value={column.header} onChange={(event) => updateColumn(column.id, { header: event.target.value })} placeholder="Column header" />
        <select aria-label={`Column ${columnIndex + 1} alignment`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={column.align ?? "left"} onChange={(event) => updateColumn(column.id, { align: event.target.value as TableConfig["alignment"] })}><option value="left">Align left</option><option value="center">Align center</option><option value="right">Align right</option></select>
        <div className="grid gap-2">{config.rows.map((row, rowIndex) => <label key={row.id} className="grid gap-1 text-xs text-ink/55">Row {rowIndex + 1}<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-sm text-ink" value={row.cells[columnIndex] ?? ""} onChange={(event) => updateCell(row.id, columnIndex, event.target.value)} /></label>)}</div>
      </div>)}
    </div>
    <div className="flex gap-2"><button type="button" className="focus-ring flex-1 rounded border border-coral px-3 py-2 text-xs font-semibold text-coral" onClick={addColumn}>Add column</button><button type="button" className="focus-ring flex-1 rounded border border-coral px-3 py-2 text-xs font-semibold text-coral" onClick={addRow}>Add row</button></div>
    <div className="grid gap-2">{config.rows.map((row, rowIndex) => <div key={row.id} className="flex items-center justify-between rounded bg-mist/50 px-2 py-1 text-xs text-ink/60"><span>Row {rowIndex + 1}</span><button type="button" className="font-semibold text-coral disabled:opacity-40" disabled={config.rows.length <= 1} onClick={() => removeRow(row.id)}>Remove</button></div>)}</div>
  </div>;
}

function CtaInspector({ block, path, onUpdate }: { block: Block; path: number[]; onUpdate: (path: number[], changes: Partial<Block>) => void }) {
  const panels = block.ctaPanels?.length ? block.ctaPanels : [defaultCtaPanel()];
  const updatePanels = (next: CtaPanel[]) => onUpdate(path, { ctaPanels: next.slice(0, 5) });
  const updatePanel = (id: string, changes: Partial<CtaPanel>) => updatePanels(panels.map((panel) => panel.id === id ? { ...panel, ...changes } : panel));
  return <div className="grid gap-3 rounded-lg border border-ink/10 p-3">
    <span className="text-xs font-semibold uppercase tracking-wider text-ink/55">CTA group settings</span>
    <div className="grid grid-cols-2 gap-2">
      <label className="grid gap-1 text-xs text-ink/60">Columns<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.ctaColumns ?? 1} onChange={(event) => onUpdate(path, { ctaColumns: Number(event.target.value) as Block["ctaColumns"] })}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-ink/60">Panel style<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.ctaPanelStyle ?? "filled"} onChange={(event) => onUpdate(path, { ctaPanelStyle: event.target.value as Block["ctaPanelStyle"] })}><option value="filled">Filled</option><option value="outlined">Outlined</option><option value="minimal">Minimal</option></select></label>
      <label className="grid gap-1 text-xs text-ink/60">Gap<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.ctaGap ?? "md"} onChange={(event) => onUpdate(path, { ctaGap: event.target.value as Block["ctaGap"] })}><option value="sm">Compact</option><option value="md">Comfortable</option><option value="lg">Spacious</option></select></label>
      <label className="grid gap-1 text-xs text-ink/60">Alignment<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.ctaAlignment ?? "left"} onChange={(event) => onUpdate(path, { ctaAlignment: event.target.value as Block["ctaAlignment"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
    </div>
    <div className="grid gap-2">{panels.map((panel, index) => <details key={panel.id} open={index === 0} className="rounded border border-ink/10"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink">CTA panel {index + 1}</summary><div className="grid gap-2 border-t border-ink/10 p-3"><label className="grid gap-1 text-xs text-ink/60">Title<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.title} onChange={(event) => updatePanel(panel.id, { title: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Supporting copy<textarea rows={3} className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.content.replace(/<[^>]+>/g, "")} onChange={(event) => updatePanel(panel.id, { content: `<p>${event.target.value}</p>` })} /></label><MediaPicker label="Panel image" value={panel.imageUrl ?? ""} onSelect={(asset) => updatePanel(panel.id, { imageUrl: asset.url, imageAlt: asset.altText ?? panel.imageAlt })} /><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Image display<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.imageDisplay ?? "none"} onChange={(event) => updatePanel(panel.id, { imageDisplay: event.target.value as CtaPanel["imageDisplay"] })}><option value="none">None</option><option value="above">Above content</option><option value="beside">Beside content</option><option value="background">Panel background</option></select></label><label className="grid gap-1 text-xs text-ink/60">Image position<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.imagePosition ?? "center"} onChange={(event) => updatePanel(panel.id, { imagePosition: event.target.value as CtaPanel["imagePosition"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></div><label className="grid gap-1 text-xs text-ink/60">Image fit<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.imageFit ?? "cover"} onChange={(event) => updatePanel(panel.id, { imageFit: event.target.value as CtaPanel["imageFit"] })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option>    </select></label><label className="grid gap-1 text-xs text-ink/60">Image hover effect<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.imageHoverEffect ?? "none"} onChange={(event) => updatePanel(panel.id, { imageHoverEffect: event.target.value as CtaPanel["imageHoverEffect"] })}><option value="none">None</option><option value="zoom">Zoom</option><option value="lift">Lift</option><option value="grayscale">Grayscale</option></select></label><label className="grid gap-1 text-xs text-ink/60">Button label<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.buttonLabel} onChange={(event) => updatePanel(panel.id, { buttonLabel: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Button link<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={panel.buttonHref} onChange={(event) => updatePanel(panel.id, { buttonHref: event.target.value })} /></label><div className="grid grid-cols-2 gap-2"><select aria-label={`CTA panel ${index + 1} button style`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={panel.buttonVariant} onChange={(event) => updatePanel(panel.id, { buttonVariant: event.target.value as CtaPanel["buttonVariant"] })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="outline">Outline</option>    <option value="light">Light</option></select><select aria-label={`CTA panel ${index + 1} button size`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={panel.buttonSize ?? "lg"} onChange={(event) => updatePanel(panel.id, { buttonSize: event.target.value as CtaPanel["buttonSize"] })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">Extra large</option></select><select aria-label={`CTA panel ${index + 1} button alignment`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={panel.buttonAlignment ?? "left"} onChange={(event) => updatePanel(panel.id, { buttonAlignment: event.target.value as CtaPanel["buttonAlignment"] })}><option value="left">Align left</option><option value="center">Align center</option><option value="right">Align right</option></select><select aria-label={`CTA panel ${index + 1} link target`} className="focus-ring rounded border border-ink/15 px-2 py-1 text-xs text-ink" value={panel.buttonTarget} onChange={(event) => updatePanel(panel.id, { buttonTarget: event.target.value as CtaPanel["buttonTarget"] })}><option value="_self">Same tab</option><option value="_blank">New tab</option></select></div>{panels.length > 1 && <button type="button" className="text-left text-xs font-semibold text-coral" onClick={() => updatePanels(panels.filter((item) => item.id !== panel.id))}>Remove panel</button>}</div></details>)}</div>
    <button type="button" disabled={panels.length >= 5} className="focus-ring rounded border border-coral px-3 py-2 text-xs font-semibold text-coral disabled:cursor-not-allowed disabled:opacity-40" onClick={() => updatePanels([...panels, defaultCtaPanel(panels.length)])}>Add CTA panel</button>
  </div>;
}

function FormInspector({ block, path, onUpdate, forms }: { block: Block; path: number[]; onUpdate: (path: number[], changes: Partial<Block>) => void; forms: FormOption[] }) {
  const form = forms.find((item) => item.id === block.formId);
  return <div className="mt-5 grid gap-3">
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Form title<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.title} onChange={(event) => onUpdate(path, { title: event.target.value })} placeholder="Optional heading" /></label>
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Reusable form<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.formId ?? ""} onChange={(event) => onUpdate(path, { formId: event.target.value || null })}><option value="">Choose a form</option>{forms.filter((item) => item.enabled).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.status.toLowerCase()})</option>)}</select></label>
    {form ? <p className="text-xs leading-5 text-ink/55">{form.name} · {form._count?.submissions ?? 0} submissions</p> : <p className="text-xs leading-5 text-ink/55">Forms are created in the full-sized builder. This inspector only controls placement.</p>}
    <a href={form ? `/admin/forms?form=${encodeURIComponent(form.id)}` : "/admin/forms"} target="_blank" rel="noreferrer" className="focus-ring inline-flex justify-center rounded-lg border border-coral px-3 py-2 text-sm font-semibold text-coral">{form ? "Open form builder" : "Create or manage forms"}</a>
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Alignment<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.alignment ?? "left"} onChange={(event) => onUpdate(path, { alignment: event.target.value as Block["alignment"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Padding<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.padding ?? "md"} onChange={(event) => onUpdate(path, { padding: event.target.value as Block["padding"] })}><option value="none">None</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
    <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Margin top<input type="number" min="0" className="block-inspector-number focus-ring rounded border border-ink/15 px-2 py-1" value={block.marginTop ?? ""} onChange={(event) => onUpdate(path, { marginTop: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Margin right<input type="number" min="0" className="block-inspector-number focus-ring rounded border border-ink/15 px-2 py-1" value={block.marginRight ?? ""} onChange={(event) => onUpdate(path, { marginRight: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Margin bottom<input type="number" min="0" className="block-inspector-number focus-ring rounded border border-ink/15 px-2 py-1" value={block.marginBottom ?? ""} onChange={(event) => onUpdate(path, { marginBottom: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Margin left<input type="number" min="0" className="block-inspector-number focus-ring rounded border border-ink/15 px-2 py-1" value={block.marginLeft ?? ""} onChange={(event) => onUpdate(path, { marginLeft: event.target.value })} /></label></div>
  </div>;
}

function BlockInspector({ block, path, previewDevice, onPreviewDevice, onUpdate, onClear, onRemove, onMove, canMoveUp, canMoveDown, menus, locations, widgets, forms }: { block: Block; path: number[]; previewDevice: ResponsiveDevice; onPreviewDevice: (device: ResponsiveDevice) => void; onUpdate: (path: number[], changes: Partial<Block>) => void; onClear: () => void; onRemove: () => void; onMove: (direction: -1 | 1) => void; canMoveUp: boolean; canMoveDown: boolean; menus: MenuOption[]; locations: LocationOption[]; widgets: WidgetOption[]; forms: FormOption[] }) {
  const responsive = previewDevice === "desktop" ? undefined : block.responsive?.[previewDevice] ?? {};
  const usesRichText = inspectorRichTextBlocks.includes(block.type);
  const isForm = block.type === "form";
  const [inspectorTab, setInspectorTab] = useState<"content" | "style">("content");
  const updateResponsive = (changes: ResponsiveSettings) => {
    if (previewDevice === "desktop") return;
    onUpdate(path, { responsive: { ...block.responsive, [previewDevice]: { ...responsive, ...changes } } });
  };
  return <Card className="block-inspector h-fit min-w-0 overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-coral">Selected element</p><h2 className="mt-1 font-semibold">{blockDefinitions[block.type].label}</h2></div><button type="button" className="focus-ring text-xs font-semibold text-ink/55 hover:text-coral" onClick={onClear}>Page settings</button></div>
    <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-ink/10 pb-4">
      <span className="mr-auto text-xs font-semibold uppercase tracking-wider text-ink/45">Element actions</span>
      <label className="flex items-center gap-2 text-xs font-semibold text-ink/60">Hide on {previewDevice}<input type="checkbox" checked={block.hidden === true} onChange={(event) => onUpdate(path, { hidden: event.target.checked })} /></label>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-35" disabled={!canMoveUp} onClick={() => onMove(-1)}>Move up</button>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-35" disabled={!canMoveDown} onClick={() => onMove(1)}>Move down</button>
      <button type="button" className="focus-ring rounded-lg border border-coral/50 px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/5" onClick={onRemove}>Remove</button>
    </div>
    <div className={`mt-4 grid rounded-lg bg-mist/70 p-1 ${isForm ? "grid-cols-1" : "grid-cols-2"}`} role="tablist" aria-label="Element settings">
      <button type="button" role="tab" aria-selected={inspectorTab === "content"} className={`focus-ring rounded-md px-3 py-2 text-xs font-semibold ${inspectorTab === "content" ? "bg-white text-ink shadow-sm" : "text-ink/55"}`} onClick={() => setInspectorTab("content")}>Content & layout</button>
      <button type="button" role="tab" aria-selected={inspectorTab === "style"} className={`focus-ring rounded-md px-3 py-2 text-xs font-semibold ${isForm ? "hidden" : ""} ${inspectorTab === "style" ? "bg-white text-ink shadow-sm" : "text-ink/55"}`} onClick={() => setInspectorTab("style")}>Style</button>
    </div>
    {isForm && <FormInspector block={block} path={path} onUpdate={onUpdate} forms={forms} />}
    <div className={`mt-5 grid gap-3 ${isForm ? "hidden" : ""}`}>
      <div className={inspectorTab === "content" ? "grid gap-3" : "hidden"}>
        {usesRichText && <div className="grid gap-2 rounded-lg border border-ink/10 p-3"><div><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Text content</span><p className="mt-1 text-xs leading-5 text-ink/50">Edit the {previewDevice} version here without shrinking the canvas editor.</p></div><RichTextField value={block.content} style={typographyStyle(block)} onChange={(content) => onUpdate(path, { content })} /></div>}
        {liveTitleBlocks.includes(block.type) && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">{block.type === "headline" ? "Heading text" : "Element title"}<input aria-label={block.type === "headline" ? "Heading text" : "Element title"} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.title} onChange={(event) => onUpdate(path, { title: event.target.value })} /></label>}
        {menuBlocks.includes(block.type) && <div className="grid gap-2 rounded-lg border border-ink/10 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Menu</span><label className="grid gap-1 text-xs text-ink/60">Menu source<select className="focus-ring rounded border border-ink/15 bg-white px-2 py-1 text-ink" value={block.menuId ? "menu:" + block.menuId : block.menuLocationId ? "location:" + block.menuLocationId : "none"} onChange={(event) => { const [kind, value] = event.target.value.split(":"); onUpdate(path, { menuId: kind === "menu" ? value : null, menuLocationId: kind === "location" ? value : null }); }}><option value="none">No menu</option><optgroup label="Specific menu">{menus.map((menu) => <option key={menu.id} value={"menu:" + menu.id}>{menu.name}</option>)}</optgroup><optgroup label="Site location">{locations.map((location) => <option key={location.id} value={"location:" + location.id}>{location.name}</option>)}</optgroup></select></label>{block.type === "hero" && <label className="grid gap-1 text-xs text-ink/60">Menu display<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.menuStyle === "large-buttons" ? "large-buttons" : block.menuStyle === "links" ? "links" : "small-buttons"} onChange={(event) => onUpdate(path, { menuStyle: event.target.value as Block["menuStyle"] })}><option value="links">Link list</option><option value="small-buttons">Small buttons</option><option value="large-buttons">Large buttons</option></select></label>}</div>}
        {block.type === "widget" && <div className="grid gap-2 rounded-lg border border-ink/10 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Widget</span><label className="grid gap-1 text-xs text-ink/60">Reusable widget<select className="focus-ring rounded border border-ink/15 bg-white px-2 py-1 text-ink" value={block.widgetId ?? ""} onChange={(event) => onUpdate(path, { widgetId: event.target.value || null })}><option value="">Choose a widget</option>{widgets.filter((widget) => widget.enabled).map((widget) => <option key={widget.id} value={widget.id}>{widget.name} ({widget.type})</option>)}</select></label><p className="text-xs leading-5 text-ink/50">Use this widget anywhere on the page. Its container controls placement, spacing, and responsive layout.</p></div>}
        {block.type === "hero" && <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 p-3 text-xs text-ink/60"><span>{block.mediaUrl ? "Hero media selected" : "No hero media selected"}</span><MediaPicker label="Add hero media" value={block.mediaUrl} onSelect={(asset) => onUpdate(path, { mediaUrl: asset.url, mediaType: "image" })} /></div>}
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Alignment<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.alignment ?? "left"} onChange={(event) => onUpdate(path, { alignment: event.target.value as Block["alignment"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        {block.type === "blockquote" && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Quote style<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.blockquoteStyle ?? "classic"} onChange={(event) => onUpdate(path, { blockquoteStyle: event.target.value as Block["blockquoteStyle"] })}><option value="classic">Classic accent</option><option value="centered">Centered</option><option value="boxed">Boxed</option><option value="quotation">Large quotation mark</option><option value="minimal">Minimal rules</option></select></label>}
        {["container", "grid"].includes(block.type) && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Vertical alignment<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.verticalAlign ?? "top"} onChange={(event) => onUpdate(path, { verticalAlign: event.target.value as Block["verticalAlign"] })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>}
        {block.type === "flex" && <div className="grid gap-3 rounded-lg border border-ink/10 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Flex layout</span><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Direction<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.flexDirection ?? "row"} onChange={(event) => onUpdate(path, { flexDirection: event.target.value as Block["flexDirection"] })}><option value="row">Row</option><option value="column">Column</option></select></label><label className="grid gap-1 text-xs text-ink/60">Wrap<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.flexWrap ?? "wrap"} onChange={(event) => onUpdate(path, { flexWrap: event.target.value as Block["flexWrap"] })}><option value="wrap">Wrap</option><option value="nowrap">No wrap</option></select></label></div><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Justify<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.flexJustify ?? "start"} onChange={(event) => onUpdate(path, { flexJustify: event.target.value as Block["flexJustify"] })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="between">Space between</option><option value="around">Space around</option></select></label><label className="grid gap-1 text-xs text-ink/60">Align<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.flexAlign ?? "stretch"} onChange={(event) => onUpdate(path, { flexAlign: event.target.value as Block["flexAlign"] })}><option value="stretch">Stretch</option><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></label></div><label className="grid gap-1 text-xs text-ink/60">Gap (px)<input type="number" min="0" max="200" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.flexGap ?? ""} onChange={(event) => onUpdate(path, { flexGap: event.target.value })} /></label></div>}
        {block.type === "flex" && previewDevice !== "desktop" && <div className="grid gap-3 rounded-lg border border-coral/20 bg-coral/5 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-coral">{previewDevice} flex layout</span><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Direction<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={responsive?.flexDirection ?? ""} onChange={(event) => updateResponsive({ flexDirection: event.target.value ? event.target.value as Block["flexDirection"] : undefined })}><option value="">Use desktop</option><option value="row">Row</option><option value="column">Column</option></select></label><label className="grid gap-1 text-xs text-ink/60">Wrap<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={responsive?.flexWrap ?? ""} onChange={(event) => updateResponsive({ flexWrap: event.target.value ? event.target.value as Block["flexWrap"] : undefined })}><option value="">Use desktop</option><option value="wrap">Wrap</option><option value="nowrap">No wrap</option></select></label></div><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Justify<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={responsive?.flexJustify ?? ""} onChange={(event) => updateResponsive({ flexJustify: event.target.value ? event.target.value as Block["flexJustify"] : undefined })}><option value="">Use desktop</option><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="between">Space between</option><option value="around">Space around</option></select></label><label className="grid gap-1 text-xs text-ink/60">Align<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={responsive?.flexAlign ?? ""} onChange={(event) => updateResponsive({ flexAlign: event.target.value ? event.target.value as Block["flexAlign"] : undefined })}><option value="">Use desktop</option><option value="stretch">Stretch</option><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></label></div><label className="grid gap-1 text-xs text-ink/60">Gap (px)        <input type="number" min="0" max="200" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={responsive?.flexGap ?? ""} placeholder="Desktop" onChange={(event) => updateResponsive({ flexGap: event.target.value || undefined })} /></label></div>}
        {block.type === "grid" && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Columns<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.columns ?? 2} onChange={(event) => onUpdate(path, { columns: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => index + 1).map((columns) => <option key={columns} value={columns}>{columns}</option>)}</select></label>}
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Padding<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.padding ?? "md"} onChange={(event) => onUpdate(path, { padding: event.target.value as Block["padding"] })}><option value="none">None</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
        <div className="grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Padding sides</span><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">{(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((side) => <label key={side} className="grid min-w-0 gap-1 text-xs text-ink/60">{side.replace("padding", "")}<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block[side] ?? ""} onChange={(event) => onUpdate(path, { [side]: event.target.value })} /></label>)}</div></div>
      </div>
      {textBlocks.includes(block.type) && <div className={`grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Typography</span><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2"><label className="grid min-w-0 gap-1 text-xs text-ink/60">Size (px)<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.fontSize ?? ""} onChange={(event) => onUpdate(path, { fontSize: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs text-ink/60">Weight<input type="number" min="100" max="900" step="100" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.fontWeight ?? ""} onChange={(event) => onUpdate(path, { fontWeight: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs text-ink/60">Line height<input type="number" min="0.8" max="3" step="0.05" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.lineHeight ?? ""} onChange={(event) => onUpdate(path, { lineHeight: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs text-ink/60">Letter (px)<input type="number" min="-10" max="20" step="0.1" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.letterSpacing ?? ""} onChange={(event) => onUpdate(path, { letterSpacing: event.target.value })} /></label></div></div>}
      {textBlocks.includes(block.type) && <div className={`grid gap-2 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Font color</span><div className="flex gap-2"><select aria-label="Preset font color" className="focus-ring min-w-0 flex-1 rounded border border-ink/15 px-2 py-1 text-xs text-ink" value="" onChange={(event) => { if (event.target.value) { if (previewDevice === "desktop") onUpdate(path, { fontColor: event.target.value }); else updateResponsive({ fontColor: event.target.value }); } }}><option value="">Choose a preset</option>{standardBackgroundColors.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Font color" type="color" className="h-8 w-10 rounded border border-ink/15 bg-white p-1" value={(previewDevice === "desktop" ? block.fontColor : responsive?.fontColor) ?? block.fontColor ?? "#17324d"} onChange={(event) => previewDevice === "desktop" ? onUpdate(path, { fontColor: event.target.value }) : updateResponsive({ fontColor: event.target.value })} /></div>{previewDevice !== "desktop" && <button type="button" className="justify-self-start text-[11px] font-semibold text-coral" onClick={() => updateResponsive({ fontColor: undefined })}>Use desktop font color</button>}</div>}
      <div className={`grid gap-2 ${inspectorTab === "style" ? "" : "hidden"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Background color</span><div className="flex gap-1">{(["desktop", "tablet", "mobile"] as const).map((device) => <button key={device} type="button" className={`focus-ring rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${previewDevice === device ? "bg-ink text-white" : "bg-mist text-ink/55"}`} onClick={() => onPreviewDevice(device)}>{device.slice(0, 1)}</button>)}</div></div><div className="flex gap-2"><select aria-label="Preset background color" className="focus-ring min-w-0 flex-1 rounded border border-ink/15 px-2 py-1 text-xs text-ink" value="" onChange={(event) => { if (event.target.value) onUpdate(path, { backgroundColor: event.target.value, backgroundType: "color", backgroundTransparent: false }); }}><option value="">Choose a preset</option>{standardBackgroundColors.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Custom background color" type="color" className="h-8 w-10 rounded border border-ink/15 bg-white p-1" value={block.backgroundColor ?? "#ffffff"} onChange={(event) => onUpdate(path, { backgroundColor: event.target.value, backgroundType: "color", backgroundTransparent: false })} /></div></div>
      <label className={`flex items-center justify-between gap-3 text-xs text-ink/60 ${inspectorTab === "style" ? "" : "hidden"}`}>Transparent background<input type="checkbox" checked={block.backgroundTransparent === true} onChange={(event) => onUpdate(path, { backgroundTransparent: event.target.checked })} /></label>
      <label className={`grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="flex items-center justify-between gap-2">Background<div className="flex gap-1">{(["desktop", "tablet", "mobile"] as const).map((device) => <button key={device} type="button" className={`focus-ring rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${previewDevice === device ? "bg-ink text-white" : "bg-mist text-ink/55"}`} onClick={() => onPreviewDevice(device)}>{device.slice(0, 1)}</button>)}</div></span><select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.backgroundType ?? "none"} onChange={(event) => onUpdate(path, { backgroundType: event.target.value as Block["backgroundType"] })}><option value="none">None</option><option value="color">Color</option><option value="image">Graphic URL</option><option value="video">Video URL</option></select></label>
      {block.backgroundType === "image" && <div className={`flex items-center justify-between gap-3 rounded-lg border border-ink/10 p-3 text-xs text-ink/60 ${inspectorTab === "style" ? "" : "hidden"}`}><span>{block.backgroundUrl ? "Background image selected" : "No background image selected"}</span><MediaPicker label="Add background" value={block.backgroundUrl} onSelect={(asset) => onUpdate(path, { backgroundUrl: asset.url, backgroundType: "image" })} /></div>}
      {block.backgroundType === "video" && <div className={`flex items-center justify-between gap-3 rounded-lg border border-ink/10 p-3 text-xs text-ink/60 ${inspectorTab === "style" ? "" : "hidden"}`}><span>{block.backgroundUrl ? "Background video selected" : "No background video selected"}</span><MediaPicker label="Add background video" mediaType="video" value={block.backgroundUrl} onSelect={(asset) => onUpdate(path, { backgroundUrl: asset.url, backgroundType: "video" })} onSelectUrl={(url) => onUpdate(path, { backgroundUrl: url, backgroundType: "video" })} /></div>}
      <div className={`grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Overlay</span><label className="grid gap-1 text-xs text-ink/60">Type<select className="focus-ring box-border min-w-0 w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.overlayType ?? "none"} onChange={(event) => onUpdate(path, { overlayType: event.target.value as Block["overlayType"] })}><option value="none">None</option><option value="color">Color</option><option value="gradient">Gradient</option><option value="image">Image</option></select></label>{block.overlayType && block.overlayType !== "none" && <label className="flex items-center justify-between gap-3 text-xs text-ink/60">Hide overlay<input type="checkbox" checked={block.overlayHidden === true} onChange={(event) => onUpdate(path, { overlayHidden: event.target.checked })} /></label>}{block.overlayType === "color" || block.overlayType === "gradient" ? <label className="grid gap-1 text-xs text-ink/60">Color<input type="color" className="h-8 w-full rounded border border-ink/15 bg-white p-1" value={block.overlayColor ?? "#17324d"} onChange={(event) => onUpdate(path, { overlayColor: event.target.value })} /></label> : null}{block.overlayType === "gradient" && <><label className="grid gap-1 text-xs text-ink/60">Second color<input type="color" className="h-8 w-full rounded border border-ink/15 bg-white p-1" value={block.overlaySecondaryColor ?? "#e66f51"} onChange={(event) => onUpdate(path, { overlaySecondaryColor: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Angle<input type="number" min="0" max="360" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.overlayAngle ?? "180"} onChange={(event) => onUpdate(path, { overlayAngle: event.target.value })} /></label></>}      {block.overlayType === "image" && <div className="grid gap-1 text-xs text-ink/60"><span>Overlay image</span><MediaPicker label="Choose image" value={block.overlayImage} onSelect={(asset) => onUpdate(path, { overlayImage: asset.url })} /></div>}{block.overlayType && block.overlayType !== "none" && <label className="grid gap-1 text-xs text-ink/60">Opacity ({block.overlayOpacity ?? "45"}%)<input type="range" min="0" max="100" value={block.overlayOpacity ?? "45"} onChange={(event) => onUpdate(path, { overlayOpacity: event.target.value })} /></label>}</div>
      {block.type === "youtube" && <div className={`grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3 ${inspectorTab === "content" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">YouTube settings</span><label className="grid min-w-0 gap-1 text-xs text-ink/60">Video URL<input className="focus-ring box-border min-w-0 w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.youtubeUrl ?? ""} onChange={(event) => onUpdate(path, { youtubeUrl: event.target.value })} placeholder="https://youtube.com/watch?v=..." /></label><div className="grid min-w-0 grid-cols-2 gap-2"><label className="grid min-w-0 gap-1 text-xs text-ink/60">Start (seconds)<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.youtubeStart ?? ""} onChange={(event) => onUpdate(path, { youtubeStart: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs text-ink/60">Stop (seconds)<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.youtubeEnd ?? ""} onChange={(event) => onUpdate(path, { youtubeEnd: event.target.value })} /></label></div>{(["youtubeAutoplay", "youtubeMute", "youtubeLoop", "youtubeControls"] as const).map((setting) => <label key={setting} className="flex min-w-0 items-center justify-between gap-3 text-xs text-ink/60">{setting.replace("youtube", "")}<input type="checkbox" checked={block[setting] ?? (setting === "youtubeMute" || setting === "youtubeControls")} onChange={(event) => onUpdate(path, { [setting]: event.target.checked })} /></label>)}</div>}
      {block.type === "image" && <div className={`grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3 ${inspectorTab === "content" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Image settings</span><div className="flex items-center justify-between gap-3 text-xs text-ink/60"><span>{block.imageUrl ? "Image selected" : "No image selected"}</span><MediaPicker value={block.imageUrl} onSelect={(asset) => onUpdate(path, { imageUrl: asset.url, imageAlt: asset.altText ?? block.imageAlt })} /></div><label className="grid min-w-0 gap-1 text-xs text-ink/60">Alt text<input className="focus-ring box-border min-w-0 w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageAlt ?? ""} onChange={(event) => onUpdate(path, { imageAlt: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs text-ink/60">Image fit<select className="focus-ring box-border min-w-0 w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageFit ?? "contain"} onChange={(event) => onUpdate(path, { imageFit: event.target.value as Block["imageFit"] })}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Fill</option></select></label></div>}
      {block.type === "image" && <div className={`grid gap-2 rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Hover and click behavior</span><label className="grid gap-1 text-xs text-ink/60">Hover effect<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageHoverEffect ?? "none"} onChange={(event) => onUpdate(path, { imageHoverEffect: event.target.value as Block["imageHoverEffect"] })}><option value="none">None</option><option value="zoom">Zoom</option><option value="lift">Lift with shadow</option><option value="grayscale">Grayscale to color</option></select></label><label className="flex items-center justify-between gap-3 text-xs text-ink/60">Hover overlay<input type="checkbox" checked={block.imageHoverOverlay === true} onChange={(event) => onUpdate(path, { imageHoverOverlay: event.target.checked })} /></label>{block.imageHoverOverlay && <><label className="grid gap-1 text-xs text-ink/60">Overlay text<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageHoverText ?? ""} onChange={(event) => onUpdate(path, { imageHoverText: event.target.value })} placeholder="View image" /></label><label className="grid gap-1 text-xs text-ink/60">Overlay opacity<input type="range" min="0" max="100" value={block.imageHoverOverlayOpacity ?? "45"} onChange={(event) => onUpdate(path, { imageHoverOverlayOpacity: event.target.value })} /></label></>}<label className="flex items-center justify-between gap-3 text-xs text-ink/60">Open in lightbox<input type="checkbox" checked={block.imageLightbox === true} onChange={(event) => onUpdate(path, { imageLightbox: event.target.checked })} /></label></div>}
      {block.type === "image" && <div className={`grid gap-2 rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Image animation</span><label className="grid gap-1 text-xs text-ink/60">Play<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageAnimationTrigger ?? "load"} onChange={(event) => onUpdate(path, { imageAnimationTrigger: event.target.value as Block["imageAnimationTrigger"] })}><option value="load">When page loads</option><option value="viewport">When image enters view</option></select></label><label className="grid gap-1 text-xs text-ink/60">Enter animation<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageEnterAnimation ?? "none"} onChange={(event) => onUpdate(path, { imageEnterAnimation: event.target.value as Block["imageEnterAnimation"] })}><option value="none">None</option><option value="fade">Fade in</option><option value="slide-up">Slide up</option><option value="slide-left">Slide left</option><option value="zoom">Zoom in</option></select></label><label className="grid gap-1 text-xs text-ink/60">Exit animation<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.imageExitAnimation ?? "none"} onChange={(event) => onUpdate(path, { imageExitAnimation: event.target.value as Block["imageExitAnimation"] })}><option value="none">None</option><option value="fade">Fade out</option><option value="slide-down">Slide down</option><option value="slide-right">Slide right</option><option value="zoom-out">Zoom out</option></select></label></div>}
      {block.type === "map" && <div className={`grid gap-2 rounded-lg border border-ink/10 p-3 ${inspectorTab === "content" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Map settings</span><label className="grid gap-1 text-xs text-ink/60">Provider<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.mapProvider ?? "google"} onChange={(event) => onUpdate(path, { mapProvider: event.target.value as Block["mapProvider"] })}><option value="google">Google Maps</option><option value="bing">Bing Maps</option><option value="openstreetmap">OpenStreetMap</option></select></label><label className="grid gap-1 text-xs text-ink/60">Address or location<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.mapAddress ?? ""} onChange={(event) => onUpdate(path, { mapAddress: event.target.value })} onBlur={(event) => onUpdate(path, { mapAddress: event.target.value.trim() })} placeholder="St. Paul's Church" /></label><label className="grid gap-1 text-xs text-ink/60">Zoom<input type="number" min="1" max="20" className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.mapZoom ?? "14"} onChange={(event) => onUpdate(path, { mapZoom: event.target.value })} /></label></div>}
      {inspectorTab === "content" && block.type === "blockquote" && <div className="grid gap-2 rounded-lg border border-ink/10 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Quote settings</span><label className="grid gap-1 text-xs text-ink/60">Quote<textarea rows={4} className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.content} onChange={(event) => onUpdate(path, { content: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Attribution<input className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.quoteCitation ?? ""} onChange={(event) => onUpdate(path, { quoteCitation: event.target.value })} placeholder="Name or source" /></label></div>}
      {inspectorTab === "content" && block.type === "list" && (() => {
        const config = parseListConfig(block.listItems);
        const update = (changes: Partial<ListConfig>) => onUpdate(path, { listItems: JSON.stringify({ ...config, ...changes }) });
        const updateItem = (id: string, text: string) => update({ items: config.items.map((item) => item.id === id ? { ...item, text } : item) });
        const addItem = () => update({ items: [...config.items, { id: `list-item-${Date.now()}`, text: "New list item" }] });
        const removeItem = (id: string) => update({ items: config.items.filter((item) => item.id !== id) });
        return <div className="grid gap-3 rounded-lg border border-ink/10 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/55">List settings</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-ink/60">List style<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.listStyle ?? "unordered"} onChange={(event) => onUpdate(path, { listStyle: event.target.value as Block["listStyle"] })}><option value="unordered">Bulleted</option><option value="ordered">Numbered</option></select></label>
            <label className="grid gap-1 text-xs text-ink/60">Marker size<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.markerSize} onChange={(event) => update({ markerSize: event.target.value as ListConfig["markerSize"] })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
            <label className="grid gap-1 text-xs text-ink/60">Bullet style<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.bullet} onChange={(event) => update({ bullet: event.target.value as ListBullet })}><option value="disc">Disc</option><option value="circle">Circle</option><option value="square">Square</option><option value="arrow">Arrow</option><option value="check">Check</option><option value="xmark">X mark</option><option value="star">Star</option><option value="none">None</option></select></label>
            <label className="grid gap-1 text-xs text-ink/60">Number style<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.numberStyle} onChange={(event) => update({ numberStyle: event.target.value as ListConfig["numberStyle"] })}><option value="decimal">1, 2, 3</option><option value="lower-alpha">a, b, c</option><option value="upper-alpha">A, B, C</option><option value="lower-roman">i, ii, iii</option><option value="upper-roman">I, II, III</option></select></label>
            <label className="grid gap-1 text-xs text-ink/60">Bullet color<input type="color" className="h-8 w-full rounded border border-ink/15 bg-white p-1" value={config.bulletColor} onChange={(event) => update({ bulletColor: event.target.value })} /></label>
            <label className="grid gap-1 text-xs text-ink/60">Text color<input type="color" className="h-8 w-full rounded border border-ink/15 bg-white p-1" value={config.textColor} onChange={(event) => update({ textColor: event.target.value })} /></label>
            <label className="grid gap-1 text-xs text-ink/60">Item spacing<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.gap} onChange={(event) => update({ gap: event.target.value as ListConfig["gap"] })}><option value="sm">Tight</option><option value="md">Comfortable</option><option value="lg">Spacious</option></select></label>
            <label className="grid gap-1 text-xs text-ink/60">Indent<select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.indent} onChange={(event) => update({ indent: event.target.value as ListConfig["indent"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
          </div>
          {block.listStyle === "ordered" && <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink/60">Start number<input type="number" min="1" className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={config.start} onChange={(event) => update({ start: Math.max(1, Number(event.target.value) || 1) })} /></label><label className="flex items-center gap-2 self-end pb-2 text-xs text-ink/60"><input type="checkbox" checked={config.reversed} onChange={(event) => update({ reversed: event.target.checked })} /> Reverse order</label></div>}
          <div className="grid gap-2">{config.items.map((item, index) => <div key={item.id} className="flex items-start gap-2"><span className="mt-2 w-5 text-xs font-semibold text-ink/45">{index + 1}</span><textarea rows={2} className="focus-ring min-w-0 flex-1 rounded border border-ink/15 px-2 py-1 text-sm text-ink" value={item.text} onChange={(event) => updateItem(item.id, event.target.value)} /><button type="button" className="focus-ring mt-1 rounded px-2 py-1 text-xs text-coral hover:bg-coral/10" onClick={() => removeItem(item.id)} aria-label={`Remove list item ${index + 1}`}>×</button></div>)}</div>
          <button type="button" className="focus-ring rounded border border-coral px-3 py-2 text-xs font-semibold text-coral" onClick={addItem}>Add list item</button>
        </div>;
      })()}
      {inspectorTab === "content" && block.type === "carousel" && <CarouselInspector block={block} path={path} previewDevice={previewDevice} onUpdate={onUpdate} />}
      {inspectorTab === "content" && block.type === "buttons" && <ButtonsInspector block={block} path={path} previewDevice={previewDevice} onUpdate={onUpdate} />}
      {inspectorTab === "content" && block.type === "table" && <TableInspector block={block} path={path} previewDevice={previewDevice} onUpdate={onUpdate} />}
      {inspectorTab === "content" && block.type === "cta" && <CtaInspector block={block} path={path} onUpdate={onUpdate} />}
      <div className={`grid gap-2 rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Dimensions</span><label className="grid gap-1 text-xs text-ink/60">Height<div className="flex gap-2"><input type="number" min="0" max={dimensionLimit(block.heightUnit ?? "px")} className="focus-ring w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.heightValue ?? ""} onChange={(event) => onUpdate(path, { heightValue: String(Math.min(dimensionLimit(block.heightUnit ?? "px"), Math.max(0, Number(event.target.value) || 0))) })} /><select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.heightUnit ?? "px"} onChange={(event) => { const unit = event.target.value as Block["heightUnit"]; onUpdate(path, { heightUnit: unit, heightValue: String(Math.min(dimensionLimit(unit ?? "px"), Number(block.heightValue ?? 0) || 0)) }); }}><option value="%">%</option><option value="px">px</option><option value="em">em</option><option value="vh">vh</option><option value="vw">vw</option></select></div><input type="range" min="0" max={dimensionLimit(block.heightUnit ?? "px")} value={Math.min(dimensionLimit(block.heightUnit ?? "px"), Number(block.heightValue ?? 0) || 0)} onChange={(event) => onUpdate(path, { heightValue: event.target.value })} /></label><label className="grid gap-1 text-xs text-ink/60">Width<div className="flex gap-2"><input type="number" min="0" max={dimensionLimit(block.widthUnit ?? "full")} className="focus-ring w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.widthValue ?? ""} onChange={(event) => onUpdate(path, { widthValue: String(Math.min(dimensionLimit(block.widthUnit ?? "full"), Math.max(0, Number(event.target.value) || 0))) })} /><select className="focus-ring rounded border border-ink/15 px-2 py-1 text-ink" value={block.widthUnit ?? "full"} onChange={(event) => { const unit = event.target.value as Block["widthUnit"]; onUpdate(path, { widthUnit: unit, widthValue: String(Math.min(dimensionLimit(unit ?? "full"), Number(block.widthValue ?? 0) || 0)) }); }}><option value="full">Full</option><option value="%">%</option><option value="px">px</option><option value="em">em</option><option value="vh">vh</option><option value="vw">vw</option></select></div><input type="range" min="0" max={dimensionLimit(block.widthUnit ?? "full")} value={Math.min(dimensionLimit(block.widthUnit ?? "full"), Number(block.widthValue ?? 0) || 0)} onChange={(event) => onUpdate(path, { widthValue: event.target.value })} /></label></div>
      <div className={`grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Margins</span><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">{(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((side) => <label key={side} className="grid min-w-0 gap-1 text-xs text-ink/60">{side.replace("margin", "")}<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block[side] ?? ""} onChange={(event) => onUpdate(path, { [side]: event.target.value })} /></label>)}</div></div>
      <div className={`grid min-w-0 gap-2 overflow-hidden rounded-lg border border-ink/10 p-3 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="text-xs font-semibold uppercase tracking-wider text-ink/55">Border</span><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2"><label className="grid min-w-0 gap-1 text-xs text-ink/60">Width<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.borderWidth ?? ""} onChange={(event) => onUpdate(path, { borderWidth: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs text-ink/60">Radius<input type="number" min="0" className="block-inspector-number focus-ring box-border rounded border border-ink/15 px-2 py-1 text-ink" value={block.borderRadius ?? ""} onChange={(event) => onUpdate(path, { borderRadius: event.target.value })} /></label></div><label className="grid gap-1 text-xs text-ink/60">Style<select className="focus-ring w-full rounded border border-ink/15 px-2 py-1 text-ink" value={block.borderStyle ?? "none"} onChange={(event) => onUpdate(path, { borderStyle: event.target.value as Block["borderStyle"] })}><option value="none">None</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label><label className="grid gap-1 text-xs text-ink/60">Color<input type="color" className="h-8 w-full rounded border border-ink/15 bg-white p-1" value={block.borderColor ?? "#1f2933"} onChange={(event) => onUpdate(path, { borderColor: event.target.value })} /></label></div>
      <label className={`grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55 ${inspectorTab === "content" ? "" : "hidden"}`}>Justify container<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.justify ?? "left"} onChange={(event) => onUpdate(path, { justify: event.target.value as Block["justify"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      {block.backgroundType === "video" && <div className={`grid gap-2 rounded-lg border border-ink/10 p-3 text-xs text-ink/60 ${inspectorTab === "style" ? "" : "hidden"}`}><span className="font-semibold uppercase tracking-wider">Video behavior</span>{(["videoControls", "videoAutoplay", "videoLoop", "videoMuted"] as const).map((setting) => <label key={setting} className="flex items-center justify-between gap-3">{setting.replace("video", "")}<input type="checkbox" checked={block[setting] ?? (setting === "videoMuted")} onChange={(event) => onUpdate(path, { [setting]: event.target.checked })} /></label>)}</div>}
      {block.type !== "image" && <label className={`grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55 ${inspectorTab === "style" ? "" : "hidden"}`}>Animation<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.animation ?? "none"} onChange={(event) => onUpdate(path, { animation: event.target.value as Block["animation"] })}><option value="none">None</option><option value="fade-in">Fade in</option><option value="slide-up">Slide up</option><option value="slide-left">Slide left</option><option value="zoom-in">Zoom in</option></select></label>}
      {block.type === "headline" && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Heading level<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.headingLevel ?? "h2"} onChange={(event) => onUpdate(path, { headingLevel: event.target.value as Block["headingLevel"] })}>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={`h${level}`}>H{level}</option>)}</select></label>}
      {block.type === "grid" && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Columns<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={block.columns ?? 2} onChange={(event) => onUpdate(path, { columns: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => index + 1).map((columns) => <option key={columns} value={columns}>{columns}</option>)}</select></label>}
    </div>
  </Card>;
}

function BlockIcon({ type }: { type: BlockType }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "container" || type === "grid") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="4" width="18" height="16" rx="2" />{type === "grid" && <path {...common} d="M12 4v16M3 12h18" />}</svg>;
  if (type === "hero") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="4" width="18" height="16" rx="2" /><circle {...common} cx="8" cy="9" r="1.5" /><path {...common} d="m4 17 5-5 3 3 2-2 6 5" /></svg>;
  if (type === "youtube") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="6" width="18" height="12" rx="3" /><path {...common} d="m10 9 5 3-5 3z" /></svg>;
  if (type === "image") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="4" width="18" height="16" rx="2" /><circle {...common} cx="8" cy="9" r="1.5" /><path {...common} d="m4 17 5-5 3 3 2-2 6 5" /></svg>;
  if (type === "map") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><path {...common} d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle {...common} cx="12" cy="10" r="2" /></svg>;
  if (type === "blockquote") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><path {...common} d="M5 7h6v5H7v5H4v-6a4 4 0 0 1 4-4M13 7h6v5h-4v5h-3v-6a4 4 0 0 1 4-4" /></svg>;
  if (type === "list") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><path {...common} d="M9 6h11M9 12h11M9 18h11" /><path {...common} d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  if (type === "headline" || type === "body") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><path {...common} d="M5 5h14M12 5v14M8 19h8" /><path {...common} d="M7 9h10M7 13h10" /></svg>;
  if (type === "cta") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="6" width="18" height="12" rx="6" /><path {...common} d="M8 12h8m-3-3 3 3-3 3" /></svg>;
  if (type === "form") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="4" y="3" width="16" height="18" rx="2" /><path {...common} d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (type === "news" || type === "carousel") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="4" width="18" height="16" rx="2" /><path {...common} d="M7 8h10M7 12h6M7 16h8" /></svg>;
  if (type === "table") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="3" y="4" width="18" height="16" rx="1" /><path {...common} d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>;
  if (type === "calendar") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><rect {...common} x="4" y="5" width="16" height="15" rx="2" /><path {...common} d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8"><path {...common} d="M4 6h16M4 12h16M4 18h16" /></svg>;
}

function ToolbarIcon({ name }: { name: string }) {
 const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
 if (name === "bold") return <span aria-hidden="true" className="font-bold">B</span>;
 if (name === "italic") return <span aria-hidden="true" className="font-serif italic">I</span>;
 if (name === "underline") return <span aria-hidden="true" className="underline">U</span>;
 if (name === "strike") return <span aria-hidden="true" className="line-through">S</span>;
 if (name === "unordered") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M9 6h11M9 12h11M9 18h11" /><path {...common} d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
 if (name === "ordered") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M10 6h10M10 12h10M10 18h10" /><path {...common} d="M4 5h1v3M4 8h2M4 11h2l-2 3h2M4 17h2l-2 3h2" /></svg>;
 if (name === "left" || name === "center" || name === "right") {
   const lines = name === "left" ? "M4 6h16M4 12h11M4 18h16" : name === "center" ? "M6 6h12M4 12h16M6 18h12" : "M4 6h16M9 12h11M4 18h16";
   return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d={lines} /></svg>;
 }
 if (name === "clear") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="m5 5 14 14M19 5 5 19M4 12h16" /></svg>;
 if (name === "link") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="m9 15 6-6M7 17H6a4 4 0 0 1 0-8h4M17 7h1a4 4 0 0 1 0 8h-4" /></svg>;
 if (name === "table") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><rect {...common} x="3" y="4" width="18" height="16" rx="1" /><path {...common} d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>;
 if (name === "html") return <span aria-hidden="true" className="font-mono text-[11px]">&lt;/&gt;</span>;
 return null;
}

function ListMarker({ bullet, color, size, label }: { bullet: ListBullet; color: string; size: "sm" | "md" | "lg"; label?: string }) {
  const dimension = size === "lg" ? 22 : size === "sm" ? 14 : 18;
  if (bullet === "none") return null;
  if (bullet === "disc" || bullet === "circle" || bullet === "square") return <span aria-hidden="true" className={`mt-1 shrink-0 ${bullet === "disc" ? "rounded-full" : bullet === "circle" ? "rounded-full border-2" : ""}`} style={{ width: dimension, height: dimension, backgroundColor: bullet === "square" || bullet === "disc" ? color : "transparent", borderColor: color }} />;
  return <svg aria-hidden="true" width={dimension} height={dimension} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><title>{label ?? bullet}</title>{bullet === "arrow" && <><path d="M4 12h14" /><path d="m13 5 7 7-7 7" /></>}{bullet === "check" && <path d="m5 12 4 4L19 6" />}{bullet === "xmark" && <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>}{bullet === "star" && <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill={color} />}</svg>;
}

function PaletteElement({ type, onClick }: { type: BlockType; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}`, data: { kind: "palette", type } });
  return <div ref={setNodeRef} className={isDragging ? "opacity-40" : ""}><Button {...attributes} {...listeners} type="button" variant="default" aria-label={`Add ${blockDefinitions[type].label}`} className="aspect-square w-full flex-col justify-center gap-2 rounded-xl !border-ink/40 !bg-white !text-ink px-2 py-3 text-center hover:!bg-mist disabled:cursor-not-allowed disabled:opacity-50" onClick={onClick}><BlockIcon type={type} /><span className="text-xs leading-tight">{blockDefinitions[type].label}</span></Button></div>;
}

function SortableLayerRow({ block, path, selected, onClick }: { block: Block; path: number[]; selected: boolean; onClick: () => void }) {
  const id = `layer:${path.join(".")}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { kind: "layer", path } });
  return <button ref={setNodeRef} type="button" {...attributes} {...listeners} onClick={onClick} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className={`focus-ring flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${isDragging ? "bg-white shadow-xl ring-2 ring-coral/20" : selected ? "bg-coral/10 font-bold text-coral" : "text-ink hover:bg-mist"}`}><span className="cursor-grab text-ink/35" aria-hidden="true">⋮⋮</span><span className="min-w-0 flex-1 truncate">{block.title || blockDefinitions[block.type].label}</span><span className="shrink-0 text-[10px] uppercase text-ink/40">{blockDefinitions[block.type].label}</span></button>;
}

function BlockEditor({ block: sourceBlock, path, parentType, selectedPath, draggedType, activeDropPath, previewDevice, onSelect, onUpdate, onDropChild, onDropTargetChange, onContextMenu, widgets, menuPreviews, forms }: { block: Block; path: number[]; parentType?: BlockType; selectedPath: number[] | null; draggedType: BlockType | null; activeDropPath: string | null; previewDevice: ResponsiveDevice; onSelect: (path: number[]) => void; onUpdate: (path: number[], changes: Partial<Block>) => void; onDropChild: (path: number[], type: BlockType) => void; onDropTargetChange: (path: number[] | null) => void; onContextMenu: (event: ReactMouseEvent, path: number[]) => void; widgets: WidgetOption[]; menuPreviews: MenuPreview[]; forms: FormOption[] }) {
  const { setNodeRef } = useDroppable({ id: `drop:${path.join(".")}`, data: { kind: "drop", path } });
  const block = editorBlockForDevice(sourceBlock, previewDevice);
  const isStructural = structuralTypes.includes(block.type);
  const isVisualMedia = ["youtube", "image", "map", "carousel"].includes(block.type);
  const blockPadding = block.padding === "none" ? "p-0" : block.padding === "sm" ? "p-3" : block.padding === "lg" ? "p-10" : "p-5";
  const blockAlignment = block.alignment === "center" ? "text-center" : block.alignment === "right" ? "text-right" : "text-left";
  const headlineSize = block.headingLevel === "h1" ? "text-5xl" : block.headingLevel === "h2" ? "text-4xl" : block.headingLevel === "h3" ? "text-3xl" : block.headingLevel === "h4" ? "text-2xl" : block.headingLevel === "h5" ? "text-xl" : "text-lg";
  const blockAnimation = block.animation && block.animation !== "none" ? `block-animation-${block.animation}` : "";
  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const data = new FormData();
    data.append("asset", file);
    const response = await fetch("/api/media/upload", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok || typeof result.url !== "string") throw new Error(result.error ?? "Unable to upload image.");
    onUpdate(path, { imageUrl: result.url });
  };
  const blockStyle: CSSProperties = {
    boxSizing: "border-box",
    ...typographyStyle(block),
    ...(block.backgroundColor && block.backgroundType !== "image" && block.backgroundType !== "video" ? { backgroundColor: block.backgroundColor } : {}),
    ...(block.backgroundTransparent ? { backgroundColor: "transparent" } : {}),
    ...(block.type !== "image" && block.backgroundType === "image" && block.backgroundUrl && !block.backgroundHidden ? { backgroundImage: `url("${block.backgroundUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
    ...(block.paddingTop ? { paddingTop: `${block.paddingTop}px` } : {}),
    ...(block.paddingRight ? { paddingRight: `${block.paddingRight}px` } : {}),
    ...(block.paddingBottom ? { paddingBottom: `${block.paddingBottom}px` } : {}),
    ...(block.paddingLeft ? { paddingLeft: `${block.paddingLeft}px` } : {}),
    ...(!["image", "map"].includes(block.type) && block.heightValue ? { height: `${block.heightValue}${block.heightUnit ?? "px"}` } : {}),
    ...(!["image", "map"].includes(block.type) && block.widthValue ? { width: block.widthUnit === "full" ? "100%" : `${block.widthValue}${block.widthUnit ?? "%"}` } : {}),
    ...(!["image", "map"].includes(block.type) && (block.marginTop || block.marginRight || block.marginBottom || block.marginLeft) ? { marginTop: block.marginTop ? `${block.marginTop}px` : undefined, marginRight: block.marginRight ? `${block.marginRight}px` : undefined, marginBottom: block.marginBottom ? `${block.marginBottom}px` : undefined, marginLeft: block.marginLeft ? `${block.marginLeft}px` : undefined } : {}),
    ...(!["image", "map"].includes(block.type) && block.borderRadius ? { borderRadius: `${block.borderRadius}px` } : {}),
    ...(!["image", "map"].includes(block.type) && block.borderStyle && block.borderStyle !== "none" ? { borderStyle: block.borderStyle, borderWidth: `${block.borderWidth ?? "1"}px`, borderColor: block.borderColor ?? "#1f2933" } : {}),
    ...(isStructural ? { minHeight: "14rem" } : {}),
    ...(block.justify === "center" ? { marginLeft: "auto", marginRight: "auto" } : block.justify === "right" ? { marginLeft: "auto" } : {})
  };
  const imageStyle: CSSProperties = {
    ...(block.heightValue ? { height: `${block.heightValue}${block.heightUnit ?? "px"}` } : {}),
    ...(block.widthValue ? { width: block.widthUnit === "full" ? "100%" : `${block.widthValue}${block.widthUnit ?? "%"}` } : {}),
    ...(block.marginTop || block.marginRight || block.marginBottom || block.marginLeft ? { marginTop: block.marginTop ? `${block.marginTop}px` : undefined, marginRight: block.marginRight ? `${block.marginRight}px` : undefined, marginBottom: block.marginBottom ? `${block.marginBottom}px` : undefined, marginLeft: block.marginLeft ? `${block.marginLeft}px` : undefined } : {}),
    ...(block.borderRadius ? { borderRadius: `${block.borderRadius}px` } : {}),
    ...(block.borderStyle && block.borderStyle !== "none" ? { borderStyle: block.borderStyle, borderWidth: `${block.borderWidth ?? "1"}px`, borderColor: block.borderColor ?? "#1f2933" } : {})
  };
  const mapStyle: CSSProperties = { ...imageStyle, width: block.widthValue ? imageStyle.width : "100%", minHeight: block.heightValue ? undefined : "20rem" };
  const mapSource = mapEmbedUrl(block.mapProvider, block.mapAddress);
  const selected = selectedPath?.join(".") === path.join(".");
  const gridColumns = Math.max(1, Math.min(12, Math.round(block.columns ?? 2)));
  const childLayoutStyle: CSSProperties | undefined = block.type === "grid"
    ? { display: "grid", gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, alignContent: block.verticalAlign === "center" ? "center" : block.verticalAlign === "bottom" ? "end" : "start", backgroundColor: "transparent", minHeight: "14rem", height: "100%" }
    : block.type === "flex"
      ? { display: "flex", flexDirection: block.flexDirection === "column" ? "column" : "row", flexWrap: block.flexWrap === "nowrap" ? "nowrap" : "wrap", gap: `${Number(block.flexGap) || 16}px`, justifyContent: block.flexJustify === "center" ? "center" : block.flexJustify === "end" ? "flex-end" : block.flexJustify === "between" ? "space-between" : block.flexJustify === "around" ? "space-around" : "flex-start", alignItems: block.flexAlign === "center" ? "center" : block.flexAlign === "end" ? "flex-end" : block.flexAlign === "start" ? "flex-start" : "stretch", backgroundColor: "transparent", minHeight: "14rem", height: "100%" }
      : isStructural
      ? { display: "flex", flexDirection: "column", justifyContent: block.verticalAlign === "center" ? "center" : block.verticalAlign === "bottom" ? "flex-end" : "flex-start", minHeight: "14rem", height: "100%" }
      : undefined;
  return <article className={`group relative min-w-0 overflow-hidden rounded-xl border transition ${blockPadding} ${blockAlignment} ${blockAnimation} ${block.hidden ? "opacity-45 outline outline-2 outline-dashed outline-coral/50" : ""} ${selected ? "border-coral ring-2 ring-coral/20" : "border-transparent"}`} style={blockStyle} onClick={(event) => { event.stopPropagation(); if (event.target instanceof HTMLElement && (event.target.closest("[contenteditable='true']") || event.target.closest("input, textarea, select, button"))) return; onSelect(path); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(path); onContextMenu(event, path); }}>
    {block.backgroundType === "video" && block.backgroundUrl && !block.backgroundHidden && <video className="pointer-events-none absolute inset-0 h-full w-full object-cover" src={block.backgroundUrl} controls={block.videoControls} autoPlay muted playsInline loop={block.videoLoop} />}
    {block.type !== "image" && block.overlayType && block.overlayType !== "none" && !block.overlayHidden && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ ...overlayStyle(block), opacity: overlayOpacity(block.overlayOpacity) }} />}
    <div className={`relative z-10 flex items-start justify-between gap-4 ${isStructural ? "h-full" : ""}`}>
      <div className={`min-w-0 flex-1 ${isStructural ? "h-full" : ""}`}>
        {liveTitleBlocks.includes(block.type) && <div className={`mt-2 px-2 py-1 font-serif ${block.type === "headline" ? headlineSize : "text-2xl"} ${blockAlignment}`} style={typographyStyle(block)}>{block.title || (block.type === "headline" ? "Heading" : "Title")}</div>}
        {isVisualMedia && <div className="mt-4 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-ink/20 bg-sand/40 p-5 text-sm text-ink/50" onDragOver={(event) => { if (block.type === "image") event.preventDefault(); }} onDrop={(event) => { if (block.type !== "image") return; event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void uploadImage(file).catch((error: Error) => window.alert(error.message)); }}>{block.type === "youtube" ? "YouTube video placeholder" : block.type === "image" ? (block.imageUrl ? <div className="relative max-w-full overflow-hidden rounded"><img src={block.imageUrl} alt="" className="block max-w-full rounded object-contain" style={imageStyle} />{block.overlayType && block.overlayType !== "none" && !block.overlayHidden && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ ...overlayStyle(block), opacity: overlayOpacity(block.overlayOpacity) }} />}</div> : "Drop an image here or use Upload image") : block.type === "carousel" ? (carouselConfig(block.content).slides[0]?.imageUrl ? <img src={carouselConfig(block.content).slides[0].imageUrl} alt="" className="max-h-64 max-w-full rounded object-contain" /> : "Add slides in the carousel settings") : mapSource ? <iframe title="Map preview" src={mapSource} className="block max-w-full rounded border-0" style={mapStyle} loading="lazy" /> : "Enter an address or location to preview the map"}</div>}
        {block.type === "widget" && (() => { const widget = widgets.find((item) => item.id === block.widgetId); const menu = widget?.type === "menu" ? menuPreviews.find((item) => item.id === widget.config.menuId) : null; const menuItems = menu && Array.isArray(menu.items) ? menu.items : []; return <div className="mt-4 rounded-lg border border-dashed border-coral/40 bg-sand/40 p-4 text-left">{!widget ? <span className="text-sm text-ink/50">Choose a widget in the element settings.</span> : widget.type === "text" ? <div className="rich-text-content text-sm text-ink/70" dangerouslySetInnerHTML={{ __html: widget.config.content || "<p>This text widget is empty.</p>" }} /> : menu ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/50">{widget.name}</p>{menuItems.length ? <ul className="grid gap-1 text-sm font-semibold text-ink/70">{menuItems.filter((item) => !item.parentId).map((item) => <li key={item.id}>{item.label}</li>)}</ul> : <span className="text-sm text-ink/50">This menu has no items.</span>}</div> : <span className="text-sm text-ink/50">{widget.name} is loading its menu data.</span>}</div>; })()}
        {block.type === "form" && <div className="mt-4 rounded-lg border border-dashed border-coral/40 bg-sand/40 p-5 text-left"><p className="font-semibold">{block.title || "Form"}</p><p className="mt-1 text-sm text-ink/55">{forms.find((item) => item.id === block.formId)?.name ?? "Choose a reusable form in the settings."}</p><div className="mt-4 grid gap-2"><span className="h-3 w-3/4 rounded bg-ink/10" /><span className="h-9 rounded border border-ink/10 bg-white" /><span className="h-3 w-2/3 rounded bg-ink/10" /><span className="h-9 rounded border border-ink/10 bg-white" /></div></div>}
        {block.type === "buttons" && <div className="mt-4 flex flex-wrap gap-2">{buttonsConfig(block.content).items.map((item) => <span key={item.id} className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white">{item.label || "Button"}</span>)}</div>}
        {block.type === "table" && <div className="mt-4 rounded-lg border border-dashed border-ink/20 bg-white p-3 text-left"><TableBlock config={parseTableConfig(block.content)} /></div>}
        {block.type === "calendar" && <div className="mt-4 rounded-xl border border-dashed border-coral/40 bg-sand/40 p-4 text-left"><div className="flex items-center gap-3"><BlockIcon type="calendar" /><div><p className="font-serif text-xl">Events calendar</p><p className="mt-1 text-sm text-ink/60">Published events · month, week, and agenda views</p></div></div><div className="mt-4 grid grid-cols-7 gap-1">{Array.from({ length: 21 }, (_, index) => <span key={index} className={`h-5 rounded-sm ${index % 6 === 0 ? "bg-coral/60" : "bg-ink/10"}`} />)}</div></div>}
        {block.type === "cta" && <div className={`mt-4 grid ${block.ctaColumns === 2 ? "grid-cols-2" : block.ctaColumns === 3 ? "grid-cols-3" : block.ctaColumns === 4 ? "grid-cols-4" : block.ctaColumns === 5 ? "grid-cols-5" : "grid-cols-1"} ${block.ctaGap === "sm" ? "gap-2" : block.ctaGap === "lg" ? "gap-6" : "gap-3"} text-left`}>{(block.ctaPanels?.length ? block.ctaPanels : [defaultCtaPanel()]).map((panel) => <div key={panel.id} className={`relative grid gap-2 rounded-lg p-4 ${panel.imageDisplay === "beside" ? "md:flex md:items-start" : ""} ${block.ctaPanelStyle === "outlined" ? "border border-coral/40" : block.ctaPanelStyle === "minimal" ? "border-b border-ink/15" : "border border-coral/25 bg-coral/10"}`}>{panel.imageUrl && panel.imageDisplay !== "background" && panel.imageDisplay !== "none" && <img src={panel.imageUrl} alt={panel.imageAlt ?? ""} className={`max-h-36 w-full rounded transition duration-300 ${panel.imageDisplay === "above" ? "-mx-4 -mt-4 mb-2 w-[calc(100%+2rem)] rounded-none" : panel.imageDisplay === "beside" ? "md:w-2/5" : ""} ${panel.imageHoverEffect === "zoom" ? "hover:scale-105" : panel.imageHoverEffect === "lift" ? "hover:-translate-y-1 hover:shadow-lg" : panel.imageHoverEffect === "grayscale" ? "grayscale hover:grayscale-0" : ""}`} style={{ objectFit: panel.imageFit ?? "cover", objectPosition: panel.imagePosition ?? "center" }} />}{panel.imageUrl && panel.imageDisplay === "background" && <div className="pointer-events-none absolute inset-0 rounded-lg bg-cover bg-center opacity-20" style={{ backgroundImage: `url("${panel.imageUrl}")`, backgroundPosition: panel.imagePosition ?? "center", backgroundSize: panel.imageFit ?? "cover" }} />}<div className="relative grid min-w-0"><strong className="text-sm text-ink">{panel.title}</strong><div className="rich-text-content text-sm text-ink/70" dangerouslySetInnerHTML={{ __html: panel.content }} /><span className={`inline-flex w-fit rounded-full font-semibold text-white ${panel.buttonVariant === "secondary" ? "bg-ink" : panel.buttonVariant === "outline" ? "border-2 border-coral text-coral" : panel.buttonVariant === "light" ? "bg-white text-ink" : "bg-coral"} ${panel.buttonSize === "sm" ? "px-3 py-1.5 text-sm" : panel.buttonSize === "xl" ? "px-8 py-5 text-lg" : panel.buttonSize === "md" ? "px-5 py-3 text-base" : "px-6 py-4 text-lg"} ${panel.buttonAlignment === "center" ? "justify-self-center" : panel.buttonAlignment === "right" ? "justify-self-end" : "justify-self-start"}`}>{panel.buttonLabel || "Learn more"}</span></div></div>)}</div>}
        {block.type === "blockquote" && <div className={`mt-4 p-4 text-ink/70 ${block.blockquoteStyle === "centered" ? "text-center font-serif text-xl italic" : block.blockquoteStyle === "boxed" ? "rounded-xl border border-ink/10 bg-sand/60 text-left font-serif text-xl italic shadow-sm" : block.blockquoteStyle === "quotation" ? "relative border-t-2 border-coral/40 pt-8 text-left font-serif text-2xl italic before:absolute before:left-0 before:top-0 before:text-7xl before:font-normal before:not-italic before:leading-none before:text-coral before:content-['“']" : block.blockquoteStyle === "minimal" ? "border-y border-ink/15 text-left font-serif text-xl italic" : "border-l-4 border-coral bg-sand/40 text-left font-serif text-2xl italic"}`}>{block.content || "Blockquote placeholder"}</div>}
        {block.type === "list" && (() => { const config = parseListConfig(block.listItems); const ordered = block.listStyle === "ordered"; return <div className="mt-4 rounded-lg border border-dashed border-ink/20 bg-sand/40 p-4 text-left text-sm" style={{ color: config.textColor }}><div className={`grid ${config.gap === "sm" ? "gap-1" : config.gap === "lg" ? "gap-4" : "gap-2"} ${config.indent === "comfortable" ? "pl-2" : ""}`}>{config.items.length ? config.items.map((item, index) => <div key={item.id} className="flex items-start gap-2">        <span className="w-6 shrink-0 text-right font-semibold" style={{ color: config.bulletColor }}>{ordered ? `${formatEditorListNumber(config.reversed ? config.start + config.items.length - index - 1 : config.start + index, config.numberStyle)}.` : <ListMarker bullet={config.bullet} color={config.bulletColor} size={config.markerSize} />}</span><span>{item.text}</span></div>) : <span className="text-ink/50">Add list items in the settings.</span>}</div></div>; })()}
        {inspectorRichTextBlocks.includes(block.type) && <div className="rich-text-content mt-3 text-ink/70" dangerouslySetInnerHTML={{ __html: block.content || "<p>Add text in the element settings.</p>" }} />}
        {isStructural && <div ref={setNodeRef} className={`relative mt-4 rounded-lg border border-dashed p-3 transition-[min-height,background-color,border-color,box-shadow] duration-150 ${activeDropPath === path.join(".") && draggedType ? "border-2 border-coral bg-coral/10 shadow-[inset_0_0_0_1px_rgba(226,91,74,0.18)]" : selected ? "border-ink/20 bg-sand/40" : "border-transparent bg-transparent"}`} style={{ height: "calc(100% - 1rem)", minHeight: activeDropPath === path.join(".") && draggedType ? "12rem" : undefined, boxSizing: "border-box" }}>
          {activeDropPath === path.join(".") && draggedType && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><span className="flex items-center gap-2 rounded-full border-2 border-coral bg-white/95 px-4 py-2 text-sm font-semibold text-coral shadow-lg"><span className="text-3xl font-light leading-none">+</span>Drop {blockDefinitions[draggedType].label} inside {blockDefinitions[block.type].label}</span></div>}
          {selected && <div className="text-xs font-semibold uppercase tracking-wider text-ink/55">{block.children?.length ? `${block.children.length} block${block.children.length === 1 ? "" : "s"} placed` : "Empty drop zone"}</div>}
          <div className="relative mt-3 min-h-16 gap-3" style={childLayoutStyle}>{block.type === "grid" && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(to right, rgba(23, 50, 77, 0.18) 0, rgba(23, 50, 77, 0.18) 1px, transparent 1px, transparent calc(100% / 12))", backgroundSize: `${100 / gridColumns * 12}% 100%` }} />}{block.children?.map((child, childIndex) => <BlockEditor key={child.id} block={child} parentType={block.type} path={[...path, childIndex]} selectedPath={selectedPath} draggedType={draggedType} activeDropPath={activeDropPath} previewDevice={previewDevice} onSelect={onSelect} onUpdate={onUpdate} onDropChild={onDropChild} onDropTargetChange={onDropTargetChange} onContextMenu={onContextMenu} widgets={widgets} menuPreviews={menuPreviews} forms={forms} />)}</div>
        </div>}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3 text-xs text-ink/50"><span>{blockDefinitions[block.type].description}</span>{parentType && <span className="rounded-full bg-mist px-2 py-1 font-semibold text-ink/55">Inside {blockDefinitions[parentType].label}</span>}</div>
  </article>;
}

export default function EditorCanvas({ pageId, empty = false }: { pageId?: string; empty?: boolean }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(empty ? [] : initialBlocks);
  const [pastBlocks, setPastBlocks] = useState<Block[][]>([]);
  const [futureBlocks, setFutureBlocks] = useState<Block[][]>([]);
  const [previewDevice, setPreviewDevice] = useState<ResponsiveDevice>("desktop");
  const [pageSettingsTab, setPageSettingsTab] = useState<"page" | "seo">("page");
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: number[] } | null>(null);
  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [activeDropPath, setActiveDropPath] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(empty ? "" : "Welcome page");
  const [slug, setSlug] = useState(empty ? "" : "welcome");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [pageThemeFamily, setPageThemeFamily] = useState("");
  const [pageThemeWidth, setPageThemeWidth] = useState("");
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [message, setMessage] = useState("");
  const [pageStatus, setPageStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pageReady, setPageReady] = useState(empty);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState<RecoveryOffer | null>(null);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [widgets, setWidgets] = useState<WidgetOption[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [menuPreviews, setMenuPreviews] = useState<MenuPreview[]>([]);
  const [reusableBlocks, setReusableBlocks] = useState<Array<{ id: string; name: string; block: Block }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [compareRevision, setCompareRevision] = useState<RevisionSummary | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [draggedLayerPath, setDraggedLayerPath] = useState<number[] | null>(null);
  const [layersPosition, setLayersPosition] = useState({ x: 24, y: 96 });
  const [layersDragging, setLayersDragging] = useState(false);
  const layersDragOffset = useRef({ x: 0, y: 0 });
  const serverUpdatedAtRef = useRef<string | null>(null);
  const autosaveControllerRef = useRef<AbortController | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { setNodeRef: setRootDropRef } = useDroppable({ id: "drop:root", data: { kind: "root" } });

  useEffect(() => {
    void Promise.all([fetch("/api/menus"), fetch("/api/menu-locations"), fetch("/api/widgets"), fetch("/api/forms")]).then(async ([menusResponse, locationsResponse, widgetsResponse, formsResponse]) => {
      if (!menusResponse.ok || !locationsResponse.ok || !widgetsResponse.ok || !formsResponse.ok) throw new Error("Unable to load editor options.");
      setMenus((await menusResponse.json() as MenuOption[]).map(({ id, name }) => ({ id, name })));
      setLocations((await locationsResponse.json() as LocationOption[]).map(({ id, name }) => ({ id, name })));
      const loadedWidgets = (await widgetsResponse.json() as WidgetOption[]).map(({ id, name, type, enabled, config }) => ({ id, name, type, enabled, config }));
      setWidgets(loadedWidgets);
      setForms(await formsResponse.json() as FormOption[]);
      const menuIds = loadedWidgets.filter((widget) => widget.enabled && widget.type === "menu" && widget.config?.menuId).map((widget) => widget.config.menuId as string);
      const menuResponses = await Promise.all(menuIds.map((id) => fetch(`/api/menus/${id}`)));
      setMenuPreviews((await Promise.all(menuResponses.filter((response) => response.ok).map((response) => response.json()))) as MenuPreview[]);
    }).catch((error: Error) => setMessage(error.message));
    if (!pageId) {
      try {
        const saved = JSON.parse(window.localStorage.getItem("page-editor-recovery:new") ?? "null") as { savedAt?: unknown; input?: PageInput } | null;
        if (saved?.input && typeof saved.savedAt === "string" && hasRecoverableDraft(saved.input)) setRecoveryOffer({ savedAt: saved.savedAt, input: saved.input });
      } catch {
        window.localStorage.removeItem("page-editor-recovery:new");
      }
      setRecoveryChecked(true);
      return;
    }
    void fetch(`/api/pages/${pageId}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load this page.");
      const page = await response.json();
      serverUpdatedAtRef.current = typeof page.updatedAt === "string" ? page.updatedAt : null;
      setPageReady(true);
      setPageTitle(page.title); setSlug(page.slug); setSeoTitle(page.seoTitle ?? ""); setSeoDescription(page.seoDescription ?? ""); setSeoKeywords(page.seoKeywords ?? ""); setPublishAt(page.publishAt ? new Date(page.publishAt).toISOString().slice(0, 16) : ""); setPageThemeFamily(page.pageThemeFamily ?? ""); setPageThemeWidth(page.pageThemeWidth ?? ""); setShowHeader(page.showHeader !== false); setShowFooter(page.showFooter !== false); setFullScreen(page.fullScreen === true); setPasswordProtected(page.passwordProtected === true); setPasswordChanged(false); setAccessPassword(""); setPageStatus(page.status === "PUBLISHED" || page.status === "ARCHIVED" ? page.status : "DRAFT");
      setBlocks((page.blocks as Array<{ id: string; type: BlockType; props: Record<string, unknown> }>).flatMap((block) => { const hydrated = hydrateBlock(block); return hydrated ? [hydrated] : []; }));
      setPastBlocks([]);
      setFutureBlocks([]);
      try {
        const saved = JSON.parse(window.localStorage.getItem(`page-editor-recovery:${pageId}`) ?? "null") as { savedAt?: unknown; input?: PageInput } | null;
        if (saved?.input && typeof saved.savedAt === "string" && new Date(saved.savedAt).getTime() > new Date(page.updatedAt).getTime()) setRecoveryOffer({ savedAt: saved.savedAt, input: saved.input });
      } catch {
        window.localStorage.removeItem(`page-editor-recovery:${pageId}`);
      }
      setRecoveryChecked(true);
    }).catch((error: Error) => setMessage(error.message));
  }, [pageId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("editor-reusable-blocks");
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ id?: unknown; name?: unknown; block?: unknown }>;
        if (Array.isArray(parsed)) setReusableBlocks(parsed.filter((item): item is { id: string; name: string; block: Block } => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && item.block && typeof item.block === "object")));
      }
    } catch {
      setReusableBlocks([]);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("editor-layers-position") ?? "null") as { x?: unknown; y?: unknown } | null;
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") setLayersPosition({ x: saved.x, y: saved.y });
    } catch {
      window.localStorage.removeItem("editor-layers-position");
    }
  }, []);

  useEffect(() => {
    if (!layersDragging) return;
    const move = (event: PointerEvent) => {
      const width = Math.min(400, window.innerWidth - 24);
      const height = Math.min(560, window.innerHeight - 24);
      const next = { x: Math.max(12, Math.min(window.innerWidth - width - 12, event.clientX - layersDragOffset.current.x)), y: Math.max(12, Math.min(window.innerHeight - height - 12, event.clientY - layersDragOffset.current.y)) };
      setLayersPosition(next);
      window.localStorage.setItem("editor-layers-position", JSON.stringify(next));
    };
    const stop = () => setLayersDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, [layersDragging]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [contextMenu]);

  function commitBlocks(update: (current: Block[]) => Block[]) {
    setBlocks((current) => {
      const next = update(current);
      setPastBlocks((past) => [...past, current].slice(-50));
      setFutureBlocks([]);
      return next;
    });
  }

  function undo() {
    setPastBlocks((past) => {
      const previous = past[past.length - 1];
      if (!previous) return past;
      setBlocks((current) => {
        setFutureBlocks((future) => [current, ...future].slice(0, 50));
        return previous;
      });
      return past.slice(0, -1);
    });
  }

  function redo() {
    setFutureBlocks((future) => {
      const next = future[0];
      if (!next) return future;
      setBlocks((current) => {
        setPastBlocks((past) => [...past, current].slice(-50));
        return next;
      });
      return future.slice(1);
    });
  }

  function selectedInsert(update: (current: Block[]) => Block[]) {
    commitBlocks(update);
  }

  function copySelected(path = selectedPath) {
    const selected = path ? blockAtPath(blocks, path) : null;
    if (!selected) return;
    window.localStorage.setItem("editor-block-clipboard", JSON.stringify(selected));
    setMessage("Block copied.");
  }

  function pasteBlock(path = selectedPath) {
    let saved: unknown;
    try {
      saved = JSON.parse(window.localStorage.getItem("editor-block-clipboard") ?? "null");
    } catch {
      saved = null;
    }
    if (!saved || typeof saved !== "object" || !("type" in saved)) {
      setMessage("Copy a block before pasting.");
      return;
    }
    const pasted = cloneBlock(saved as Block);
    selectedInsert((current) => path ? insertAfterPath(current, path, pasted) : [...current, pasted]);
    setMessage("Block pasted.");
  }

  function saveReusableBlock() {
    const selected = selectedPath ? blockAtPath(blocks, selectedPath) : null;
    if (!selected) return;
    const name = window.prompt("Name this reusable block", blockDefinitions[selected.type].label);
    if (!name?.trim()) return;
    const item = { id: `reusable-${Date.now()}`, name: name.trim(), block: cloneBlock(selected) };
    setReusableBlocks((current) => {
      const next = [...current, item];
      window.localStorage.setItem("editor-reusable-blocks", JSON.stringify(next));
      return next;
    });
    setMessage("Reusable block saved.");
  }

  function insertReusableBlock(item: { block: Block }) {
    const inserted = cloneBlock(item.block);
    selectedInsert((current) => selectedPath ? insertAfterPath(current, selectedPath, inserted) : [...current, inserted]);
    setMessage("Reusable block inserted.");
  }

  function deleteReusableBlock(id: string) {
    setReusableBlocks((current) => {
      const next = current.filter((item) => item.id !== id);
      window.localStorage.setItem("editor-reusable-blocks", JSON.stringify(next));
      return next;
    });
  }

  async function saveDraft() {
    autosaveControllerRef.current?.abort();
    if (passwordProtected && passwordChanged && accessPassword.length < 8) {
      setMessage("Page passwords must be at least 8 characters.");
      return;
    }
    const input: PageInput = { title: pageTitle, slug, seoTitle: seoTitle || null, seoDescription: seoDescription || null, seoKeywords: seoKeywords || null, publishAt: publishAt ? new Date(publishAt).toISOString() : null, pageThemeFamily: pageThemeFamily || null, pageThemeWidth: pageThemeWidth || null, showHeader, showFooter, fullScreen, blocks: blocks.map(serialize), ...(serverUpdatedAtRef.current ? { expectedUpdatedAt: serverUpdatedAtRef.current } : {}), ...(passwordChanged ? { accessPassword: passwordProtected ? accessPassword : null } : {}) };
    let response: Response;
    try {
      response = await fetch(pageId ? `/api/pages/${pageId}` : "/api/pages", { method: pageId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(pageId ? { "x-page-save-mode": "manual" } : {}) }, body: JSON.stringify(input) });
    } catch {
      setMessage("Unable to save. Check your connection and try again.");
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to save."); return; }
    if (typeof body.updatedAt === "string") serverUpdatedAtRef.current = body.updatedAt;
    setPasswordProtected(body.passwordProtected === true);
    setPasswordChanged(false);
    setAccessPassword("");
    window.localStorage.removeItem(`page-editor-recovery:${pageId ?? "new"}`);
    setRecoveryOffer(null);
    setMessage(pageId ? "Saved successfully." : "Page created successfully.");
    if (!pageId && body.id) router.replace(`/admin/editor/${body.id}`);
  }

  useEffect(() => {
    if (!pageReady || !recoveryChecked || recoveryOffer) return;
    const input: PageInput = { title: pageTitle, slug, seoTitle: seoTitle || null, seoDescription: seoDescription || null, seoKeywords: seoKeywords || null, publishAt: publishAt ? new Date(publishAt).toISOString() : null, pageThemeFamily: pageThemeFamily || null, pageThemeWidth: pageThemeWidth || null, showHeader, showFooter, fullScreen, blocks: blocks.map(serialize), ...(serverUpdatedAtRef.current ? { expectedUpdatedAt: serverUpdatedAtRef.current } : {}) };
    const recoveryKey = `page-editor-recovery:${pageId ?? "new"}`;
    try {
      window.localStorage.setItem(recoveryKey, JSON.stringify({ input, savedAt: new Date().toISOString() }));
    } catch {
      setAutosaveState("error");
      return;
    }
    if (!pageId) {
      setAutosaveState("saved");
      return;
    }
    setAutosaveState("saving");
    const controller = new AbortController();
    autosaveControllerRef.current = controller;
    const timer = window.setTimeout(() => {
      void fetch(`/api/pages/${pageId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-page-save-mode": "autosave" }, body: JSON.stringify(input), signal: controller.signal })
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error ?? "Autosave failed.");
          if (typeof result.updatedAt === "string") serverUpdatedAtRef.current = result.updatedAt;
          window.localStorage.removeItem(recoveryKey);
          setAutosaveState("saved");
        })
        .catch((error: Error) => { if (error.name !== "AbortError") { setAutosaveState("error"); setMessage(error.message); } });
    }, 900);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (autosaveControllerRef.current === controller) autosaveControllerRef.current = null;
    };
  }, [blocks, fullScreen, pageId, pageReady, pageThemeFamily, pageThemeWidth, pageTitle, publishAt, recoveryChecked, recoveryOffer, seoDescription, seoKeywords, seoTitle, showFooter, showHeader, slug]);

  function restoreRecovery() {
    if (!recoveryOffer) return;
    const input = recoveryOffer.input;
    setPageTitle(input.title); setSlug(input.slug); setSeoTitle(input.seoTitle ?? ""); setSeoDescription(input.seoDescription ?? ""); setSeoKeywords(input.seoKeywords ?? ""); setPublishAt(input.publishAt ? new Date(input.publishAt).toISOString().slice(0, 16) : ""); setPageThemeFamily(input.pageThemeFamily ?? ""); setPageThemeWidth(input.pageThemeWidth ?? ""); setShowHeader(input.showHeader !== false); setShowFooter(input.showFooter !== false); setFullScreen(input.fullScreen === true);
    setBlocks(input.blocks.flatMap((block) => { const hydrated = hydrateBlock(block); return hydrated ? [hydrated] : []; }));
    setRecoveryOffer(null);
    setMessage("Recovered your newer local draft. Saving it now.");
  }

  function discardRecovery() {
    window.localStorage.removeItem(`page-editor-recovery:${pageId ?? "new"}`);
    setRecoveryOffer(null);
    setMessage("Local recovery draft discarded.");
  }

  function updateBlock(path: number[], changes: Partial<Block>) {
    commitBlocks((current) => updateAtPath(current, path, (block) => {
      if (previewDevice === "desktop" || "responsive" in changes) return { ...block, ...changes };
      const currentResponsive = block.responsive?.[previewDevice] ?? {};
      const responsiveChanges = Object.fromEntries(Object.entries(changes).filter(([key, value]) => key !== "children" && value !== undefined)) as Partial<ResponsiveSettings>;
      return { ...block, responsive: { ...block.responsive, [previewDevice]: { ...currentResponsive, ...responsiveChanges } } };
    }));
  }
  async function loadRevisions() {
    if (!pageId) return;
    const response = await fetch(`/api/pages/${pageId}/revisions`);
    if (!response.ok) throw new Error("Unable to load revision history.");
    setRevisions(await response.json() as RevisionSummary[]);
  }
  async function restoreRevision(revision: RevisionSummary) {
    if (!pageId || !window.confirm(`Restore the ${revision.kind.toLowerCase()} from ${new Date(revision.createdAt).toLocaleString()}?`)) return;
    autosaveControllerRef.current?.abort();
    const response = await fetch(`/api/pages/${pageId}/revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisionId: revision.id, expectedUpdatedAt: serverUpdatedAtRef.current }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error ?? "Unable to restore revision."); return; }
    window.localStorage.removeItem(`page-editor-recovery:${pageId}`);
    window.location.reload();
  }
  function removeBlock(path: number[]) { commitBlocks((current) => removeAtPath(current, path)); }
  function duplicateBlock(path: number[]) {
    const selected = blockAtPath(blocks, path);
    if (!selected) return;
    const duplicate = cloneBlock(selected);
    commitBlocks((current) => insertAfterPath(current, path, duplicate));
    setSelectedPath([...path.slice(0, -1), path[path.length - 1] + 1]);
    setMessage("Block duplicated.");
  }
  function resetBlock(path: number[]) {
    const selected = blockAtPath(blocks, path);
    if (!selected) return;
    const defaults = createBlock(selected.type);
    commitBlocks((current) => updateAtPath(current, path, () => ({ ...defaults, id: selected.id, title: selected.title, content: selected.content, children: selected.children })));
    setMessage("Element settings reset.");
  }
  function updateTableAtPath(path: number[], update: (config: TableConfig) => TableConfig) {
    const selected = blockAtPath(blocks, path);
    if (!selected || selected.type !== "table") return;
    updateBlock(path, { content: tableConfigContent(update(parseTableConfig(selected.content))) });
  }
  function addTableRowAtPath(path: number[]) {
    updateTableAtPath(path, (config) => ({
      ...config,
      rows: [...config.rows, { id: `table-row-${Date.now()}`, cells: config.columns.map(() => "") }],
    }));
  }
  function removeTableRowAtPath(path: number[]) {
    updateTableAtPath(path, (config) => config.rows.length > 1 ? { ...config, rows: config.rows.slice(0, -1) } : config);
  }
  function addTableColumnAtPath(path: number[]) {
    updateTableAtPath(path, (config) => ({
      ...config,
      columns: [...config.columns, { id: `table-column-${Date.now()}`, header: `Column ${config.columns.length + 1}`, align: "left" }],
      rows: config.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })),
    }));
  }
  function removeTableColumnAtPath(path: number[]) {
    updateTableAtPath(path, (config) => {
      if (config.columns.length <= 1) return config;
      const lastColumnIndex = config.columns.length - 1;
      return {
        ...config,
        columns: config.columns.slice(0, -1),
        rows: config.rows.map((row) => ({ ...row, cells: row.cells.slice(0, lastColumnIndex) })),
      };
    });
  }
  function openContextMenu(event: ReactMouseEvent, path: number[]) {
    const menuHeight = blockAtPath(blocks, path)?.type === "table" ? 460 : 280;
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 220), y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)), path });
  }
  function addChild(path: number[], type: BlockType) { commitBlocks((current) => updateAtPath(current, path, (block) => ({ ...block, children: [...(block.children ?? []), createBlock(type)] }))); }
  function dropChild(path: number[], type: BlockType) { addChild(path, type); setDraggedType(null); }
  function addBlock(type: BlockType) {
    commitBlocks((current) => {
      if (structuralTypes.includes(type)) return [...current, createBlock(type)];
      const selected = selectedPath ? blockAtPath(current, selectedPath) : null;
      const selectedContainer = selected && structuralTypes.includes(selected.type) ? selectedPath : null;
      const lastContainerIndex = current.map((block, index) => structuralTypes.includes(block.type) ? index : -1).filter((index) => index >= 0).pop();
      const targetPath = selectedContainer ?? (lastContainerIndex === undefined ? null : [lastContainerIndex]);
      if (targetPath) return updateAtPath(current, targetPath, (container) => ({ ...container, children: [...(container.children ?? []), createBlock(type)] }));
      const container = createBlock("container");
      container.children = [createBlock(type)];
      return [...current, container];
    });
  }
  const selectedBlock = selectedPath ? blockAtPath(blocks, selectedPath) : null;
  const contextBlock = contextMenu ? blockAtPath(blocks, contextMenu.path) : null;
  const selectedIndex = selectedPath && selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : -1;
  const selectedParent = selectedPath && selectedPath.length > 0 ? blockAtPath(blocks, selectedPath.slice(0, -1)) : null;
  const canMoveSelectedUp = selectedIndex > 0;
  const canMoveSelectedDown = selectedIndex >= 0 && selectedParent?.children ? selectedIndex < selectedParent.children.length - 1 : false;
  const removeSelected = () => {
    if (!selectedPath) return;
    removeBlock(selectedPath);
    setSelectedPath(null);
  };
  const moveSelected = (direction: -1 | 1) => {
    if (!selectedPath || selectedPath.length === 0) return;
    commitBlocks((current) => moveChildAtPath(current, selectedPath.slice(0, -1), selectedIndex, direction));
  };
  const moveLayer = (targetPath: number[], sourcePath = draggedLayerPath) => {
    if (!sourcePath || sourcePath.length === 0 || targetPath.length === 0) return;
    const sourceParent = sourcePath.slice(0, -1);
    const targetParent = targetPath.slice(0, -1);
    const targetBlock = blockAtPath(blocks, targetPath);
    if (targetBlock && structuralTypes.includes(targetBlock.type)) {
      const moved = moveBlockToContainer(blocks, sourcePath, targetPath);
      if (moved.blocks !== blocks) {
        commitBlocks(() => moved.blocks);
        setSelectedPath(moved.path);
      }
      return;
    }
    if (sourceParent.join(".") !== targetParent.join(".")) {
      setMessage("Layers can be reordered within the same container.");
      return;
    }
    const from = sourcePath[sourcePath.length - 1];
    const to = targetPath[targetPath.length - 1];
    if (from === to) return;
    commitBlocks((current) => reorderChildrenAtPath(current, sourceParent, from, to));
    setSelectedPath(targetPath);
  };
  const renderLayer = (block: Block, path: number[]) => <div key={block.id} className="grid gap-1">
    <SortableLayerRow block={block} path={path} selected={selectedPath?.join(".") === path.join(".")} onClick={() => setSelectedPath(path)} />
    {block.children?.length ? <SortableContext items={block.children.map((_, index) => `layer:${[...path, index].join(".")}`)} strategy={verticalListSortingStrategy}><div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">{block.children.map((child, index) => renderLayer(child, [...path, index]))}</div></SortableContext> : null}
  </div>;
  const elementButton = (type: BlockType) => <PaletteElement key={type} type={type} onClick={() => addBlock(type)} />;
  const applyAutoLayout = () => {
    if (previewDevice === "desktop") return;
    commitBlocks((current) => autoLayoutBlocks(current, previewDevice));
    setMessage(`Recommended ${previewDevice} layout applied. Use Undo to revert it.`);
  };
  const handleDragOver = ({ over }: DragOverEvent) => {
    const overId = String(over?.id ?? "");
    setActiveDropPath(overId.startsWith("drop:") ? overId.slice(5) : null);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const activeData = active.data.current as { kind?: string; type?: BlockType; path?: number[] } | undefined;
    const overData = over?.data.current as { kind?: string; path?: number[] } | undefined;
    if (activeData?.kind === "palette" && activeData.type) {
      if (overData?.kind === "drop" && overData.path) dropChild(overData.path, activeData.type);
      else if (overData?.kind === "root") addBlock(activeData.type);
    } else if (activeData?.kind === "layer" && overData?.kind === "layer" && activeData.path && overData.path) {
      moveLayer(overData.path, activeData.path);
    }
    setDraggedType(null);
    setDraggedLayerPath(null);
    setActiveDropPath(null);
  };

  return   <DndContext sensors={sensors} onDragStart={({ active }) => { const data = active.data.current as { kind?: string; type?: BlockType } | undefined; setDraggedType(data?.kind === "palette" ? data.type ?? null : null); }} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={() => { setDraggedType(null); setDraggedLayerPath(null); setActiveDropPath(null); }}><div className="flex h-full min-h-0 flex-col gap-4">
    {message && <p role="status" aria-live="polite" className="lg:col-span-2 rounded-lg border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p>}
    {recoveryOffer && <div role="alert" className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/25 bg-amber-50 px-4 py-3 text-sm text-amber-950"><div><p className="font-bold">A newer local draft is available.</p><p className="mt-1 text-amber-950/75">Recovered from {new Date(recoveryOffer.savedAt).toLocaleString()}.</p></div><div className="flex gap-2"><button type="button" className="focus-ring rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white hover:bg-ink/90" onClick={restoreRecovery}>Restore draft</button><button type="button" className="focus-ring rounded-lg border border-amber-900/25 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100" onClick={discardRecovery}>Discard</button></div></div>}
    <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" onClick={undo} disabled={!pastBlocks.length}>Undo</button>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" onClick={redo} disabled={!futureBlocks.length}>Redo</button>
      <span className="h-5 w-px bg-ink/15" aria-hidden="true" />
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" onClick={() => copySelected()} disabled={!selectedBlock}>Copy</button>
      <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink" onClick={() => pasteBlock()}>Paste</button>
      <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-xs font-semibold text-coral disabled:cursor-not-allowed disabled:opacity-40" onClick={saveReusableBlock} disabled={!selectedBlock}>Save reusable block</button>
      <details className="relative">
        <summary className="focus-ring cursor-pointer list-none rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink">Reusable blocks ({reusableBlocks.length})</summary>
        <div className="absolute right-0 z-30 mt-2 grid w-72 gap-2 rounded-xl border border-ink/15 bg-white p-3 shadow-xl">
          {reusableBlocks.length === 0 ? <p className="text-xs text-ink/55">Save a selected block to reuse it on other pages.</p> : reusableBlocks.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-mist/60 px-3 py-2"><span className="min-w-0 truncate text-xs font-semibold text-ink">{item.name}</span><span className="flex shrink-0 gap-2"><button type="button" className="focus-ring text-xs font-semibold text-coral" onClick={() => insertReusableBlock(item)}>Insert</button><button type="button" aria-label={`Delete ${item.name}`} className="focus-ring text-xs text-ink/50 hover:text-coral" onClick={() => deleteReusableBlock(item.id)}>×</button></span></div>)}
        </div>
      </details>
      <button type="button" className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold ${layersOpen ? "border-ink bg-ink text-white" : "border-ink/15 text-ink"}`} aria-pressed={layersOpen} onClick={() => setLayersOpen((current) => !current)}>Layers</button>
      {layersOpen && <div className="fixed z-50 grid max-h-[min(36rem,calc(100vh-1.5rem))] w-[min(25rem,calc(100vw-1.5rem))] gap-2 overflow-hidden rounded-xl border border-ink/15 bg-white shadow-2xl" style={{ left: layersPosition.x, top: layersPosition.y }} role="dialog" aria-label="Layers panel">
        <div className="flex cursor-move items-center gap-3 border-b border-ink/10 bg-ink px-3 py-2 text-white" onPointerDown={(event) => { if (event.target instanceof HTMLElement && event.target.closest("button")) return; layersDragOffset.current = { x: event.clientX - layersPosition.x, y: event.clientY - layersPosition.y }; setLayersDragging(true); }}><span className="mr-auto text-xs font-bold uppercase tracking-wider">Layers</span><span className="text-[10px] text-white/60">Drag to move</span><button type="button" aria-label="Close layers panel" className="focus-ring rounded px-2 py-1 text-lg leading-none text-white/75 hover:bg-white/10 hover:text-white" onClick={() => setLayersOpen(false)}>×</button></div>
        <div className="grid min-h-0 gap-2 overflow-y-auto p-3">
          <p className="text-xs leading-5 text-ink/55">Select a layer to edit it. Drag a layer onto another layer in the same container to reorder it.</p>
          {blocks.length ? <SortableContext items={blocks.map((_, index) => `layer:${index}`)} strategy={verticalListSortingStrategy}><div className="grid gap-1">{blocks.map((block, index) => renderLayer(block, [index]))}</div></SortableContext> : <p className="rounded-lg bg-mist/60 p-3 text-xs text-ink/55">No layers yet.</p>}
        </div>
      </div>}
      <button type="button" className="focus-ring ml-2 rounded-lg bg-coral px-4 py-2 text-xs font-bold text-white shadow-md shadow-coral/25 ring-2 ring-coral/15 hover:bg-[#d95f43] hover:shadow-lg" onClick={() => void saveDraft()}>Save</button>
      {pageId && <details className="relative" open={historyOpen} onToggle={(event) => { const open = (event.currentTarget as HTMLDetailsElement).open; setHistoryOpen(open); if (open && !revisions.length) void loadRevisions().catch((error: Error) => setMessage(error.message)); }}>
        <summary className="focus-ring cursor-pointer list-none rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink">History</summary>
        <div className="absolute right-0 z-30 mt-2 grid max-h-[32rem] w-96 max-w-[calc(100vw-2rem)] gap-2 overflow-y-auto rounded-xl border border-ink/15 bg-white p-3 shadow-xl">
          {revisions.length === 0 ? <p className="text-xs text-ink/55">No saved revisions yet.</p> : revisions.map((revision) => <div key={revision.id} className="grid gap-2 rounded-lg border border-ink/10 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-ink">{revision.kind === "MANUAL" ? "Manual save" : "Autosave"}</p><p className="text-[11px] text-ink/55">{new Date(revision.createdAt).toLocaleString()} · {revision.author.name}</p></div><span className="text-[11px] text-ink/45">{Array.isArray(revision.snapshot?.blocks) ? revision.snapshot.blocks.length : Array.isArray(revision.blocks) ? revision.blocks.length : 0} blocks</span></div><div className="flex gap-2"><button type="button" className="focus-ring rounded border border-ink/15 px-2 py-1 text-[11px] font-semibold text-ink" onClick={() => setCompareRevision(revision)}>Compare</button><button type="button" className="focus-ring rounded border border-coral/50 px-2 py-1 text-[11px] font-semibold text-coral" onClick={() => void restoreRevision(revision)}>Restore</button></div></div>)}
        </div>
      </details>}
      {compareRevision && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4" role="dialog" aria-modal="true" aria-label="Revision comparison" onClick={() => setCompareRevision(null)}><div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-coral">Revision comparison</p><h2 className="mt-1 font-semibold">{compareRevision.kind === "MANUAL" ? "Manual save" : "Autosave"}</h2><p className="mt-1 text-xs text-ink/55">{new Date(compareRevision.createdAt).toLocaleString()} · {compareRevision.author.name}</p></div><button type="button" className="focus-ring text-xl text-ink/50 hover:text-ink" aria-label="Close comparison" onClick={() => setCompareRevision(null)}>×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-mist/60 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Current editor</p><p className="mt-2 text-sm">{pageTitle}</p><p className="mt-1 text-xs text-ink/55">{blocks.length} top-level blocks</p></div><div className="rounded-lg bg-sand/60 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Selected revision</p><p className="mt-2 text-sm">{compareRevision.snapshot?.title ?? compareRevision.title}</p><p className="mt-1 text-xs text-ink/55">{Array.isArray(compareRevision.snapshot?.blocks) ? compareRevision.snapshot.blocks.length : 0} top-level blocks</p></div></div><p className="mt-4 text-xs leading-5 text-ink/55">Restore applies the complete saved page snapshot, including page settings and nested elements.</p></div></div>}
      <span className="text-xs font-medium text-ink/50">{pageStatus.toLowerCase()} · {autosaveState === "saving" ? "Autosaving…" : autosaveState === "saved" ? "Autosaved" : autosaveState === "error" ? "Autosave unavailable" : "Ready"}</span>
      <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-ink/45">Preview</span>
      {([["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"]] as const).map(([device, label]) => <button key={device} type="button" aria-pressed={previewDevice === device} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold ${previewDevice === device ? "border-ink bg-ink text-white" : "border-ink/15 text-ink hover:bg-mist"}`} onClick={() => setPreviewDevice(device)}>{label}</button>)}
      {previewDevice !== "desktop" && <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/10" onClick={applyAutoLayout}>Auto layout</button>}
    </div>
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section ref={setRootDropRef} aria-label={`${previewDevice} page canvas`} className={`admin-editor-canvas min-h-0 overflow-y-auto rounded-2xl border border-dashed bg-white/70 px-1 py-3 transition-[border-color,background-color,box-shadow] duration-150 sm:px-2 sm:py-5 ${pageThemeFamily ? `page-theme-${pageThemeFamily}` : ""} ${pageThemeWidth ? `page-width-${pageThemeWidth}` : ""} ${activeDropPath === "root" && draggedType ? "border-2 border-coral bg-coral/5 shadow-[inset_0_0_0_2px_rgba(226,91,74,0.12)]" : "border-ink/20"}`} style={{ width: previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? "768px" : "390px", maxWidth: previewDevice === "desktop" && pageThemeWidth === "contained" ? "78rem" : "100%", marginInline: "auto" }} onClick={() => setSelectedPath(null)}>
        {activeDropPath === "root" && draggedType && <div aria-hidden="true" className="pointer-events-none sticky top-1 z-30 flex justify-center"><span className="flex items-center gap-2 rounded-full border-2 border-coral bg-white/95 px-4 py-2 text-sm font-semibold text-coral shadow-lg"><span className="text-2xl font-light leading-none">+</span>Drop {blockDefinitions[draggedType].label} here</span></div>}
      <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink/45"><span>12-column grid</span><span>{blocks.length} elements</span></div>
      <div className="grid grid-cols-12 gap-0">{blocks.map((block, index) => <div key={block.id} className="col-span-12"><BlockEditor block={block} path={[index]} selectedPath={selectedPath} activeDropPath={activeDropPath} draggedType={draggedType} previewDevice={previewDevice} onSelect={setSelectedPath} onUpdate={updateBlock} onDropChild={dropChild} onDropTargetChange={(path) => setActiveDropPath(path ? path.join(".") : null)} onContextMenu={openContextMenu} widgets={widgets} menuPreviews={menuPreviews} forms={forms} /></div>)}</div>
    </section>
    <div className="min-h-0 overflow-y-auto">{selectedPath && selectedBlock ? <BlockInspector block={editorBlockForDevice(selectedBlock, previewDevice)} path={selectedPath} previewDevice={previewDevice} onPreviewDevice={setPreviewDevice} onUpdate={updateBlock} onClear={() => setSelectedPath(null)} onRemove={removeSelected} onMove={moveSelected} canMoveUp={canMoveSelectedUp} canMoveDown={canMoveSelectedDown} menus={menus} locations={locations} widgets={widgets} forms={forms} /> : <Card className="h-fit">
      <h2 className="font-semibold">Page settings</h2>
      <div className="mt-4 grid grid-cols-2 rounded-lg bg-mist/70 p-1" role="tablist" aria-label="Page settings">
        <button type="button" role="tab" aria-selected={pageSettingsTab === "page"} className={`focus-ring rounded-md px-3 py-2 text-xs font-semibold ${pageSettingsTab === "page" ? "bg-white text-ink shadow-sm" : "text-ink/55"}`} onClick={() => setPageSettingsTab("page")}>Page</button>
        <button type="button" role="tab" aria-selected={pageSettingsTab === "seo"} className={`focus-ring rounded-md px-3 py-2 text-xs font-semibold ${pageSettingsTab === "seo" ? "bg-white text-ink shadow-sm" : "text-ink/55"}`} onClick={() => setPageSettingsTab("seo")}>SEO & publishing</button>
      </div>
      <div className="mt-4 grid gap-3">
        <div className={pageSettingsTab === "page" ? "grid gap-3" : "hidden"}>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Title<input required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">URL slug<input required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
          <details className="rounded-lg border border-ink/10 p-3" open><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink/55">Page chrome</summary><div className="mt-3 grid gap-3 text-sm"><label className="flex items-center justify-between gap-3">Show header<input type="checkbox" checked={showHeader} onChange={(event) => setShowHeader(event.target.checked)} /></label><label className="flex items-center justify-between gap-3">Show footer<input type="checkbox" checked={showFooter} onChange={(event) => setShowFooter(event.target.checked)} /></label><label className="flex items-center justify-between gap-3">Full-screen first section<input type="checkbox" checked={fullScreen} onChange={(event) => setFullScreen(event.target.checked)} /></label></div></details>
        </div>
        <details className={pageSettingsTab === "seo" ? "rounded-lg border border-ink/10 p-3" : "hidden"} open><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink/55">Search and publishing</summary><div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">SEO title<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder={pageTitle || "Page title"} /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">SEO description<textarea rows={3} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Search keywords<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} placeholder="worship, community, welcome" /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Publish on<input type="datetime-local" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} /></label>
          <div className="grid gap-2 rounded-lg border border-ink/10 p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">Password protection<input type="checkbox" checked={passwordProtected} onChange={(event) => { setPasswordProtected(event.target.checked); setPasswordChanged(true); setAccessPassword(""); }} /></label>
            {passwordProtected && <label className="grid gap-1 text-xs text-ink/60">{passwordChanged ? "New page password" : "Replace page password"}
              <input type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder={passwordChanged ? "At least 8 characters" : "Leave blank to keep current"} className="focus-ring rounded border border-ink/15 px-2 py-1.5 text-sm text-ink" value={accessPassword} onChange={(event) => { setAccessPassword(event.target.value); setPasswordChanged(true); }} />
            </label>}
            <p className="text-xs leading-5 text-ink/50">Protected pages remain hidden from search metadata and require their own password after publication.</p>
          </div>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Page theme<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={pageThemeFamily} onChange={(event) => setPageThemeFamily(event.target.value)}><option value="">Use site theme</option><option value="classic">Classic</option><option value="tailwind">Tailwind</option><option value="material">Material</option></select></label><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Page width<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={pageThemeWidth} onChange={(event) => setPageThemeWidth(event.target.value)}><option value="">Use site theme</option><option value="full">Full width</option><option value="contained">Contained</option></select></label>
        </div></details>
      </div>
      <h2 className="mt-7 font-semibold">Page elements</h2><p className="mt-1 text-sm text-ink/55">Drag or choose an element to add to the canvas.</p>
      {elementCategories.map((category, index) => <div key={category.label}>
        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink/50">{category.label}</h3>
        {index === 0 && <p className="mt-1 text-xs text-ink/50">Add a container before placing other elements.</p>}
        <div className="mt-3 grid grid-cols-2 gap-3">{category.types.map(elementButton)}</div>
      </div>)}
    </Card>}</div>
    </div>
    {contextMenu && <div role="menu" aria-label="Element context menu" className="fixed z-[60] grid max-h-[calc(100vh-1rem)] min-w-52 gap-1 overflow-y-auto rounded-xl border border-ink/15 bg-white p-1.5 text-sm shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left font-semibold text-coral hover:bg-coral/10" onClick={() => { setSelectedPath(contextMenu.path); setContextMenu(null); }}>Edit</button>
      <div className="my-1 border-t border-ink/10" />
      <button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { copySelected(contextMenu.path); setSelectedPath(contextMenu.path); setContextMenu(null); }}>Copy</button>
      <button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { pasteBlock(contextMenu.path); setSelectedPath(contextMenu.path); setContextMenu(null); }}>Paste after</button>
      <button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { duplicateBlock(contextMenu.path); setContextMenu(null); }}>Duplicate</button>
      <button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { resetBlock(contextMenu.path); setContextMenu(null); }}>Reset settings</button>
      {contextBlock?.type === "table" && <><div className="my-1 border-t border-ink/10" /><span className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-ink/45">Table</span><button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { addTableRowAtPath(contextMenu.path); setSelectedPath(contextMenu.path); setContextMenu(null); }}>Add row</button><button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { removeTableRowAtPath(contextMenu.path); setSelectedPath(contextMenu.path); setContextMenu(null); }}>Remove last row</button><button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { addTableColumnAtPath(contextMenu.path); setSelectedPath(contextMenu.path); setContextMenu(null); }}>Add column</button><button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-ink hover:bg-mist" onClick={() => { removeTableColumnAtPath(contextMenu.path); setSelectedPath(contextMenu.path); setContextMenu(null); }}>Remove last column</button></>}
      <div className="my-1 border-t border-ink/10" />
      <button type="button" role="menuitem" className="rounded-lg px-3 py-2 text-left text-coral hover:bg-coral/10" onClick={() => { removeBlock(contextMenu.path); if (selectedPath?.join(".") === contextMenu.path.join(".")) setSelectedPath(null); setContextMenu(null); }}>Remove</button>
    </div>}
  </div></DndContext>;
}
