import { describe, expect, it } from "vitest";
import { blockDefinitions } from "@/lib/blocks";
import { parsePublicationInput } from "@/lib/announcement-publications";
import { announcementDocumentToHtml, defaultAnnouncementDocument, parseAnnouncementDocument, parseOrMigrateAnnouncementDocument } from "@/lib/announcement-document";

describe("announcement publications", () => {
  it("requires a title and non-empty rich content", () => {
    expect(() => parsePublicationInput({ title: "", bodyHtml: "<p>Content</p>" })).toThrow("title");
    expect(() => parsePublicationInput({ title: "Weekly news", bodyHtml: "<p> </p>" })).toThrow("content");
  });

  it("sanitizes unsafe publication markup while preserving useful content", () => {
    const publication = parsePublicationInput({
      title: "Weekly news",
      bodyHtml: `<h2>Welcome</h2><p><a href="/events">Events</a></p><script>alert(1)</script>`
    });
    expect(publication.bodyHtml).toContain("Welcome");
    expect(publication.bodyHtml).toContain('href="/events"');
    expect(publication.bodyHtml).not.toContain("<script");
  });

  it("defines the announcements page element", () => {
    expect(blockDefinitions.announcements).toEqual({
      label: "Announcements",
      description: "Latest publication with links to the announcement archive",
      defaultSpan: 12
    });
  });

  it("accepts a visual document as the canonical publication payload", () => {
    const document = defaultAnnouncementDocument("Christmas service");
    const publication = parsePublicationInput({ title: "Christmas service", documentJson: document });
    expect(publication.documentJson).toEqual(parseAnnouncementDocument(document));
    expect(publication.bodyHtml).toContain("Christmas service");
    expect(publication.bodyHtml).toContain("announcement-document");
  });

  it("migrates legacy HTML when a document is not present", () => {
    const document = parseOrMigrateAnnouncementDocument(null, "Weekly news", "<p>Welcome <strong>home</strong>.</p>");
    expect(parseAnnouncementDocument(document)).not.toBeNull();
    expect(announcementDocumentToHtml(document)).toContain("Welcome home.");
  });
});
