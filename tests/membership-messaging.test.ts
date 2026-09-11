import { describe, expect, it } from "vitest";
import { interpolateMessage, sanitizeEmailHtml } from "@/lib/membership-messaging";

describe("membership messaging", () => {
  it("interpolates merge tags case-insensitively", () => {
    expect(interpolateMessage("Hi {{FIRSTNAME}} {{ familyName }}", "Alex", "Smith", { familyName: "The Smith Family" }))
      .toBe("Hi Alex The Smith Family");
  });

  it("removes executable and event-handler HTML", () => {
    expect(sanitizeEmailHtml('<p onclick="alert(1)">Hello</p><script>alert(1)</script><a href="javascript:alert(1)">Link</a>'))
      .toBe("<p>Hello</p><a>Link</a>");
  });
});
