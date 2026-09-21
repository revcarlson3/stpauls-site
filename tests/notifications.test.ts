import { describe, expect, it } from "vitest";
import { canSendToGroup, canSendToUser, MAX_NOTIFICATION_RECIPIENTS } from "@/lib/notifications";

describe("notification authorization", () => {
  it("limits non-admins to their group or administrators", () => {
    expect(canSendToUser({ senderIsAdmin: false, senderGroupId: "staff", recipientGroupId: "staff", recipientIsAdmin: false })).toBe(true);
    expect(canSendToUser({ senderIsAdmin: false, senderGroupId: "staff", recipientGroupId: "member", recipientIsAdmin: true })).toBe(true);
    expect(canSendToUser({ senderIsAdmin: false, senderGroupId: "staff", recipientGroupId: "member", recipientIsAdmin: false })).toBe(false);
  });

  it("allows administrators to target any group and enforces the broadcast cap", () => {
    expect(canSendToGroup({ senderIsAdmin: true, senderGroupId: "staff", targetGroupId: "other" })).toBe(true);
    expect(canSendToGroup({ senderIsAdmin: false, senderGroupId: "staff", targetGroupId: "other" })).toBe(false);
    expect(MAX_NOTIFICATION_RECIPIENTS).toBe(500);
  });
});
