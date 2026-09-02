export type BlockType =
  | "pre-header"
  | "header"
  | "breadcrumbs"
  | "hero"
  | "headline"
  | "body"
  | "sidebar"
  | "cta"
  | "form"
  | "news"
  | "carousel"
  | "footer";

export type BlockDefinition = {
  label: string;
  description: string;
  defaultSpan: number;
};

export const blockDefinitions: Record<BlockType, BlockDefinition> = {
  "pre-header": { label: "Pre-header", description: "Contact details, ticker, or emergency notice", defaultSpan: 12 },
  header: { label: "Header", description: "Site identity and primary navigation", defaultSpan: 12 },
  breadcrumbs: { label: "Breadcrumbs", description: "Page hierarchy navigation", defaultSpan: 12 },
  hero: { label: "Hero", description: "Responsive image or video feature", defaultSpan: 12 },
  headline: { label: "Headline", description: "Headline, tagline, or introduction", defaultSpan: 8 },
  body: { label: "Main body", description: "Rich page content", defaultSpan: 8 },
  sidebar: { label: "Sidebar", description: "Optional side menu or supporting features", defaultSpan: 4 },
  cta: { label: "Call to action", description: "Prompt with a link or action", defaultSpan: 6 },
  form: { label: "Form", description: "Collect and route visitor responses", defaultSpan: 6 },
  news: { label: "News / blog", description: "Category-filtered posts", defaultSpan: 12 },
  carousel: { label: "Carousel", description: "Rotating images or featured content", defaultSpan: 12 },
  footer: { label: "Footer", description: "Site links and closing information", defaultSpan: 12 }
};

