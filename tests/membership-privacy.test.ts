import { describe, expect, it } from "vitest";
import { isListedInMemberDirectory, membershipMessageEligibility } from "@/lib/membership-privacy";

describe("membership privacy", () => {
  it("requires both family and individual directory visibility", () => {
    expect(isListedInMemberDirectory({ directoryListed: true, family: { directoryListed: true } })).toBe(true);
    expect(isListedInMemberDirectory({ directoryListed: false, family: { directoryListed: true } })).toBe(false);
    expect(isListedInMemberDirectory({ directoryListed: true, family: { directoryListed: false } })).toBe(false);
  });

  it("enforces channel consent and contact availability", () => {
    const member = {
      status: "ACTIVE",
      email: "member@example.com",
      cellphone: "5551234567",
      emailMessagesAllowed: true,
      smsMessagesAllowed: false
    };
    expect(membershipMessageEligibility(member, "EMAIL")).toEqual({
      eligible: true,
      address: "member@example.com",
      reason: null
    });
    expect(membershipMessageEligibility(member, "SMS")).toEqual({
      eligible: false,
      address: null,
      reason: "SMS messages not allowed"
    });
  });

  it("never sends to an archived member, including retries", () => {
    expect(membershipMessageEligibility({
      status: "REMOVED",
      email: "member@example.com",
      cellphone: "5551234567",
      emailMessagesAllowed: true,
      smsMessagesAllowed: true
    }, "EMAIL")).toEqual({
      eligible: false,
      address: null,
      reason: "Member is archived"
    });
  });

  it("excludes do-not-contact members from every messaging audience channel", () => {
    const member = {
      status: "ACTIVE",
      email: "member@example.com",
      cellphone: "5551234567",
      emailMessagesAllowed: true,
      smsMessagesAllowed: true,
      doNotContact: true
    };
    expect(membershipMessageEligibility(member, "EMAIL").reason).toBe("Do not contact");
    expect(membershipMessageEligibility(member, "SMS").reason).toBe("Do not contact");
  });
});
