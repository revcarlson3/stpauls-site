import { describe, expect, it } from "vitest";
import { isListedInMemberDirectory, membershipMessageEligibility, resolveMembershipMessageRecipient } from "@/lib/membership-privacy";

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

  it("uses an opted-in family member when the volunteer lacks a channel", () => {
    const member = {
      id: "child",
      status: "ACTIVE",
      email: null,
      cellphone: null,
      emailMessagesAllowed: false,
      smsMessagesAllowed: false,
      doNotContact: false,
      family: {
        email: null,
        phone: null,
        phoneIsMobile: false,
        individuals: [{
          id: "parent",
          status: "ACTIVE",
          email: "parent@example.com",
          cellphone: "555-0100",
          emailMessagesAllowed: true,
          smsMessagesAllowed: true,
          doNotContact: false
        }]
      }
    };
    expect(resolveMembershipMessageRecipient(member, "EMAIL")).toEqual({ eligible: true, address: "parent@example.com", reason: null });
    expect(resolveMembershipMessageRecipient(member, "SMS")).toEqual({ eligible: true, address: "555-0100", reason: null });
  });

  it("uses a family shared contact when no family member has the channel", () => {
    const member = {
      id: "child",
      status: "ACTIVE",
      email: null,
      cellphone: null,
      emailMessagesAllowed: false,
      smsMessagesAllowed: false,
      doNotContact: false,
      family: { email: "family@example.com", phone: "555-0101", phoneIsMobile: true, individuals: [] }
    };
    expect(resolveMembershipMessageRecipient(member, "EMAIL")).toEqual({ eligible: true, address: "family@example.com", reason: null });
    expect(resolveMembershipMessageRecipient(member, "SMS")).toEqual({ eligible: true, address: "555-0101", reason: null });
  });

  it("does not bypass a volunteer's do-not-contact setting for family fallback", () => {
    const member = {
      id: "child",
      status: "ACTIVE",
      email: null,
      cellphone: null,
      emailMessagesAllowed: false,
      smsMessagesAllowed: false,
      doNotContact: true,
      family: { email: "family@example.com", phone: "555-0101", phoneIsMobile: true, individuals: [] }
    };
    expect(resolveMembershipMessageRecipient(member, "EMAIL").eligible).toBe(false);
    expect(resolveMembershipMessageRecipient(member, "SMS").eligible).toBe(false);
  });
});
