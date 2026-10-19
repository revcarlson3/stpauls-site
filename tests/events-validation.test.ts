import { describe, expect, it } from "vitest";
import { DEFAULT_EVENT_TYPES, eventTypeIsAllowed } from "@/lib/event-validation";

describe("event type validation", () => {
  it("accepts the values emitted by the calendar form when no custom settings exist", () => {
    expect(DEFAULT_EVENT_TYPES).toContain("OTHER");
    expect(eventTypeIsAllowed("OTHER", undefined)).toBe(true);
  });

  it("uses configured event types without weakening the allowlist", () => {
    expect(eventTypeIsAllowed("SERVICE", ["SERVICE"])).toBe(true);
    expect(eventTypeIsAllowed("OTHER", ["SERVICE"])).toBe(false);
  });
});
