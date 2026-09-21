export type GoogleFont = {
  family: string;
  category: string;
  subsets: string[];
  axes: string[];
  tags: string[];
};

let fontsPromise: Promise<GoogleFont[]> | null = null;

async function loadFonts() {
  const response = await fetch("https://fonts.google.com/metadata/fonts", { next: { revalidate: 86400 } });
  if (!response.ok) throw new Error("Unable to load Google Fonts.");
  const payload = await response.json() as { familyMetadataList?: Array<Record<string, unknown>> };
  return (payload.familyMetadataList ?? []).map((font) => ({
    family: typeof font.family === "string" ? font.family : "",
    category: typeof font.category === "string" ? font.category : "",
    subsets: Array.isArray(font.subsets) ? font.subsets.filter((value): value is string => typeof value === "string") : [],
    axes: Array.isArray(font.axes) ? font.axes.map((axis) => typeof axis === "object" && axis && "tag" in axis && typeof axis.tag === "string" ? axis.tag : "").filter(Boolean) : [],
    tags: Array.isArray(font.tags) ? font.tags.filter((value): value is string => typeof value === "string") : []
  })).filter((font) => font.family);
}

export async function searchGoogleFonts(query: string) {
  fontsPromise ??= loadFonts();
  const fonts = await fontsPromise;
  const normalized = query.trim().toLowerCase();
  return fonts
    .filter((font) => !normalized || [font.family, font.category, ...font.subsets, ...font.axes, ...font.tags].join(" ").toLowerCase().includes(normalized))
    .slice(0, 40);
}
