export type WidgetInput = {
  name: string;
  type: "menu" | "text";
  area: "sidebar" | "footer" | "page";
  config: Record<string, unknown>;
  position?: number;
  enabled?: boolean;
};

export function parseWidgetInput(value: unknown): WidgetInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || !input.name.trim()) return null;
  if (input.type !== "menu" && input.type !== "text") return null;
  if (input.area !== "sidebar" && input.area !== "footer" && input.area !== "page") return null;
  if (!input.config || typeof input.config !== "object" || Array.isArray(input.config)) return null;
  return { name: input.name.trim(), type: input.type, area: input.area, config: input.config as Record<string, unknown>, position: typeof input.position === "number" ? input.position : 0, enabled: input.enabled !== false };
}
