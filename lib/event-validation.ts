export const DEFAULT_EVENT_TYPES = ["Worship", "Class", "Fellowship", "Outreach", "Meeting", "Other"] as const;

export function resolveEventType(value: unknown, configuredTypes: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const eventTypes: readonly string[] = Array.isArray(configuredTypes)
    ? configuredTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : DEFAULT_EVENT_TYPES;
  return eventTypes.find((eventType) => eventType === value) ??
    eventTypes.find((eventType) => eventType.toLowerCase() === normalized) ??
    null;
}

export function eventTypeIsAllowed(value: unknown, configuredTypes: unknown) {
  return value === undefined || resolveEventType(value, configuredTypes) !== null;
}
