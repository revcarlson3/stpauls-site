export const DEFAULT_EVENT_TYPES = ["WORSHIP", "CLASS", "FELLOWSHIP", "OUTREACH", "MEETING", "OTHER"] as const;

export function eventTypeIsAllowed(value: unknown, configuredTypes: unknown) {
  const eventTypes: readonly string[] = Array.isArray(configuredTypes)
    ? configuredTypes.filter((item): item is string => typeof item === "string")
    : DEFAULT_EVENT_TYPES;
  return value === undefined || eventTypes.includes(String(value));
}
