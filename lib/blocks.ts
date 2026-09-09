export type BlockType =
  | "container"
  | "flex"
  | "grid"
  | "hero"
  | "youtube"
  | "image"
  | "map"
  | "headline"
  | "body"
  | "blockquote"
  | "list"
  | "sidebar"
  | "cta"
  | "form"
  | "news"
  | "carousel"
  | "buttons"
  | "table"
  | "widget"
  ;

export type BlockDefinition = {
  label: string;
  description: string;
  defaultSpan: number;
};

export type LayoutBlockProps = {
  layout?: "stack" | "flex" | "grid";
  columns?: number;
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  flexGap?: string;
  flexJustify?: "start" | "center" | "end" | "between" | "around";
  flexAlign?: "start" | "center" | "end" | "stretch";
  children?: Array<{ id: string; type: string; props: Record<string, unknown> }>;
};

export type TableAlignment = "left" | "center" | "right";
export type TableSpacing = "compact" | "comfortable";
export type TableColumn = { id: string; header: string; align?: TableAlignment };
export type TableRow = { id: string; cells: string[] };
export type TableConfig = {
  caption: string;
  columns: TableColumn[];
  rows: TableRow[];
  headerRow: boolean;
  striped: boolean;
  spacing: TableSpacing;
  responsive: boolean;
  alignment: TableAlignment;
};

export function defaultTableConfig(): TableConfig {
  return {
    caption: "",
    columns: [
      { id: "table-column-1", header: "Column 1", align: "left" },
      { id: "table-column-2", header: "Column 2", align: "left" },
    ],
    rows: [
      { id: "table-row-1", cells: ["Value 1", "Value 2"] },
      { id: "table-row-2", cells: ["Value 3", "Value 4"] },
    ],
    headerRow: true,
    striped: false,
    spacing: "comfortable",
    responsive: true,
    alignment: "left",
  };
}

export function parseTableConfig(value: unknown): TableConfig {
  const fallback = defaultTableConfig();
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
  const source = parsed as Record<string, unknown>;
  const columns = Array.isArray(source.columns)
    ? source.columns.flatMap((column, index) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) return [];
      const item = column as Record<string, unknown>;
      return [{
        id: typeof item.id === "string" && item.id ? item.id : `table-column-${index + 1}`,
        header: typeof item.header === "string" ? item.header : `Column ${index + 1}`,
        align: item.align === "center" || item.align === "right" ? item.align : "left",
      } satisfies TableColumn];
    })
    : [];
  const safeColumns = columns.length ? columns : fallback.columns;
  const rows = Array.isArray(source.rows)
    ? source.rows.flatMap((row, index) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return [];
      const item = row as Record<string, unknown>;
      const cells = Array.isArray(item.cells) ? item.cells.map((cell) => typeof cell === "string" ? cell : String(cell ?? "")) : [];
      return [{ id: typeof item.id === "string" && item.id ? item.id : `table-row-${index + 1}`, cells: safeColumns.map((_, columnIndex) => cells[columnIndex] ?? "") }];
    })
    : [];
  return {
    caption: typeof source.caption === "string" ? source.caption : "",
    columns: safeColumns,
    rows: rows.length ? rows : fallback.rows.map((row) => ({ ...row, cells: safeColumns.map((_, index) => row.cells[index] ?? "") })),
    headerRow: source.headerRow !== false,
    striped: source.striped === true,
    spacing: source.spacing === "compact" ? "compact" : "comfortable",
    responsive: source.responsive !== false,
    alignment: source.alignment === "center" || source.alignment === "right" ? source.alignment : "left",
  };
}

export function tableConfigContent(config: TableConfig) {
  return JSON.stringify(config);
}

export const blockDefinitions: Record<BlockType, BlockDefinition> = {
  container: { label: "Container", description: "Full-width section that holds other elements", defaultSpan: 12 },
  flex: { label: "Flex container", description: "One-dimensional row or column layout for nested elements", defaultSpan: 12 },
  grid: { label: "Grid container", description: "Responsive columns for nested content elements", defaultSpan: 12 },
  hero: { label: "Hero", description: "Responsive image or video feature", defaultSpan: 12 },
  youtube: { label: "YouTube", description: "Embedded YouTube video with playback controls", defaultSpan: 8 },
  image: { label: "Image", description: "Uploaded or externally hosted image", defaultSpan: 8 },
  map: { label: "Map", description: "Embedded map from a supported provider", defaultSpan: 12 },
  headline: { label: "Headline", description: "Headline, tagline, or introduction", defaultSpan: 8 },
  body: { label: "Text", description: "Rich page content", defaultSpan: 8 },
  blockquote: { label: "Blockquote", description: "Highlighted quotation with attribution", defaultSpan: 8 },
  list: { label: "List", description: "Configurable ordered or unordered list", defaultSpan: 8 },
  sidebar: { label: "Sidebar", description: "Optional side menu or supporting features", defaultSpan: 4 },
  cta: { label: "Call to action", description: "Prompt with a link or action", defaultSpan: 6 },
  form: { label: "Form", description: "Collect and route visitor responses", defaultSpan: 6 },
  news: { label: "News / blog", description: "Category-filtered posts", defaultSpan: 12 },
  carousel: { label: "Carousel", description: "Rotating images or featured content", defaultSpan: 12 },
  buttons: { label: "Buttons", description: "One or more links, actions, or anchor buttons", defaultSpan: 8 },
  table: { label: "Table", description: "Structured rows and columns with responsive public rendering", defaultSpan: 12 },
  widget: { label: "Widget", description: "Reusable menu or text content", defaultSpan: 12 },
};
