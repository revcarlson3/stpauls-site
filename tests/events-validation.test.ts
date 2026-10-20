import { describe, expect, it } from "vitest";
import { DEFAULT_EVENT_TYPES, eventTypeIsAllowed, resolveEventType } from "@/lib/event-validation";

describe("event type validation", () => {
  it("accepts the values emitted by the calendar form when no custom settings exist", () => {
    expect(DEFAULT_EVENT_TYPES).toContain("Other");
    expect(eventTypeIsAllowed("OTHER", undefined)).toBe(true);
    expect(resolveEventType("OTHER", undefined)).toBe("Other");
  });

  it("uses configured event types without weakening the allowlist", () => {
    expect(eventTypeIsAllowed("SERVICE", ["SERVICE"])).toBe(true);
    expect(eventTypeIsAllowed("OTHER", ["SERVICE"])).toBe(false);
    expect(resolveEventType("worship", ["Worship", "Class"])).toBe("Worship");
    expect(resolveEventType("CLASS", ["CLASS"])).toBe("CLASS");
  });
});
