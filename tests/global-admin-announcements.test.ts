import { describe, expect, it } from "vitest";
import { announcementPlacements, parseAnnouncementInput } from "@/lib/global-admin-announcements";
import { validateGlobalAnnouncementImage } from "@/lib/global-announcement-assets";
import { sanitizeAnnouncementHtml, sanitizeTickerHtml } from "@/lib/announcement-content";

describe("global announcement dashboard placement", () => {
  it("offers all supported placement choices", () => {
    expect(announcementPlacements).toEqual(["AUTHENTICATED", "PUBLIC_TICKER", "BOTH", "ADMIN_DASHBOARD"]);
  });

  it("requires dashboard placement to remain global-only", () => {
    expect(parseAnnouncementInput({ title: "Notice", body: "Message", audience: "GLOBAL", placement: "ADMIN_DASHBOARD" }).placement).toBe("ADMIN_DASHBOARD");
    expect(() => parseAnnouncementInput({ title: "Notice", body: "Message", audience: "TENANT", churchId: "church-1", placement: "ADMIN_DASHBOARD" }, { allowTenant: true })).toThrow("Admin Dashboard announcements must be global.");
  });

  it("accepts signed image bytes and rejects spoofed uploads", () => {
    expect(validateGlobalAnnouncementImage("notice.png", "image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toEqual({ extension: "png", originalName: "notice.png" });
    expect(() => validateGlobalAnnouncementImage("notice.png", "image/png", new Uint8Array([1, 2, 3]))).toThrow("valid");
    expect(() => validateGlobalAnnouncementImage("notice.svg", "image/svg+xml", new Uint8Array([60, 115, 118, 103, 62]))).toThrow("valid");
  });

  it("constrains ticker content while preserving rich dashboard content", () => {
    const body = `<h2 style="font-size: 96px">Notice</h2><img src="/announcement.png" width="900"><p><strong>Read</strong> <a href="/details">more</a></p><script>alert(1)</script>`;
    expect(sanitizeTickerHtml(body)).toBe("Notice <strong>Read</strong> <a href=\"/details\">more</a>");
    expect(sanitizeTickerHtml(body)).not.toContain("<img");
    expect(sanitizeTickerHtml(body)).not.toContain("font-size");
    expect(sanitizeAnnouncementHtml(body)).toContain("<img src=\"/announcement.png\" width=\"900\">");
    expect(sanitizeAnnouncementHtml(body)).toContain("<h2 style=\"font-size: 96px\">Notice</h2>");
    expect(sanitizeAnnouncementHtml(body)).not.toContain("<script");
  });
});
