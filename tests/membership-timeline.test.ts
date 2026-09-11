import { describe, expect, it } from "vitest";
import { membershipAuditDetails, recordTimelineItems, sortTimelineItems } from "@/lib/membership-timeline";

describe("membership timeline", () => {
  it("combines entries in newest-first order and applies the requested limit", () => {
    const items = sortTimelineItems([
      { id: "old", type: "note", title: "Old", occurredAt: "2025-01-01T00:00:00.000Z" },
      { id: "new", type: "audit", title: "New", occurredAt: "2025-03-01T00:00:00.000Z" },
      { id: "new", type: "audit", title: "Duplicate", occurredAt: "2025-03-01T00:00:00.000Z" },
      { id: "middle", type: "volunteer", title: "Middle", occurredAt: "2025-02-01T00:00:00.000Z" }
    ], 2);

    expect(items.map((item) => item.id)).toEqual(["new", "middle"]);
  });

  it("includes created and meaningfully different updated metadata", () => {
    const items = recordTimelineItems({
      id: "member-1",
      label: "Individual record",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z"),
      individualId: "member-1",
      individualName: "Jane Doe"
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title)).toEqual(["Individual record created", "Individual record last updated"]);
    expect(items.every((item) => item.individualId === "member-1")).toBe(true);
  });

  it("writes searchable entity identifiers into audit details", () => {
    const details = membershipAuditDetails({
      familyId: "family-1",
      individualId: "member-1",
      noteId: "note-1",
      reason: "Follow-up"
    });

    expect(JSON.parse(details)).toEqual({
      familyId: "family-1",
      individualId: "member-1",
      noteId: "note-1",
      reason: "Follow-up"
    });
    expect(details).toContain("member-1");
  });
});
