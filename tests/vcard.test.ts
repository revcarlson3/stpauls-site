import { describe, expect, it } from "vitest";
import { buildVCard } from "@/lib/vcard";

describe("vCard export", () => {
  it("creates an Outlook-compatible contact with escaped values", () => {
    expect(buildVCard({
      firstName: "Anne",
      lastName: "Smith, Jr.",
      email: "anne@example.org",
      phone: "+1 (555) 010-1234",
      address: "123 Main St; Apt 2"
    })).toBe([
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Smith\\, Jr.;Anne;;;",
      "FN:Anne Smith\\, Jr.",
      "EMAIL;TYPE=INTERNET:anne@example.org",
      "TEL;TYPE=VOICE:+1 (555) 010-1234",
      "ADR;TYPE=HOME:;;123 Main St\\; Apt 2;;;;",
      "END:VCARD",
      ""
    ].join("\r\n"));
  });
});
