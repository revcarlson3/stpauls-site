import { describe, expect, it } from "vitest";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone-numbers";

describe("phone numbers", () => {
  it("stores digits only", () => {
    expect(normalizePhoneNumber("(320) 555-0123")).toBe("3205550123");
    expect(normalizePhoneNumber("+1 320-555-0123")).toBe("13205550123");
    expect(normalizePhoneNumber("")).toBeNull();
  });

  it("formats stored digits for display", () => {
    expect(formatPhoneNumber("3205550123")).toBe("(320) 555-0123");
    expect(formatPhoneNumber("13205550123")).toBe("+1 (320) 555-0123");
  });
});
