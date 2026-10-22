import { describe, expect, it } from "vitest";
import { blockDefinitions } from "@/lib/blocks";
import { parsePublicationInput } from "@/lib/announcement-publications";
import { ANNOUNCEMENT_SHAPES, announcementCanvasDropPoint, announcementDocumentToHtml, centeredAnnouncementPosition, defaultAnnouncementDocument, parseAnnouncementDocument, parseOrMigrateAnnouncementDocument } from "@/lib/announcement-document";

describe("announcement publications", () => {
  it("centers inserted elements within the page and keeps oversized elements inside the margin", () => {
    expect(centeredAnnouncementPosition(1200, 800, 400, 200)).toEqual({ x: 400, y: 300 });
    expect(centeredAnnouncementPosition(300, 200, 400, 300)).toEqual({ x: 24, y: 24 });
  });

  it("converts drops from the visible canvas bounds instead of the editor column bounds", () => {
    expect(announcementCanvasDropPoint(500, 400, { left: 180, top: 100 }, 0.5)).toEqual({ x: 640, y: 600 });
  });

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
    const title = document.elements.find((element) => element.id === "title");
    if (title?.type === "text") title.underline = true;
    const publication = parsePublicationInput({ title: "Christmas service", documentJson: document });
    expect(publication.documentJson).toEqual(parseAnnouncementDocument(document));
    expect(publication.bodyHtml).toContain("Christmas service");
    expect(publication.bodyHtml).toContain("text-decoration:underline");
    expect(publication.bodyHtml).toContain("announcement-document");
  });

  it("migrates legacy HTML when a document is not present", () => {
    const document = parseOrMigrateAnnouncementDocument(null, "Weekly news", "<p>Welcome <strong>home</strong>.</p>");
    expect(parseAnnouncementDocument(document)).not.toBeNull();
    expect(announcementDocumentToHtml(document)).toContain("Welcome home.");
  });

  it("preserves multipage documents, text links, and shape variants", () => {
    const document = {
      ...defaultAnnouncementDocument("Page one"),
      pages: [
        {
          id: "page-1",
          width: 900,
          height: 1200,
          background: "#fff",
          elements: [
            { id: "linked", type: "text" as const, x: 20, y: 20, width: 300, height: 50, text: "Read more", fontSize: 24, fontFamily: "Roboto", fill: "#000", align: "left" as const, link: "https://example.com" },
            { id: "circle", type: "rect" as const, shape: "circle" as const, x: 20, y: 100, width: 100, height: 100, fill: "#e66f51", cornerRadius: 50 }
          ]
        }
      ]
    };
    const parsed = parseAnnouncementDocument(document);
    expect(parsed?.pages).toHaveLength(1);
    expect(announcementDocumentToHtml(parsed!)).toContain("https://example.com");
    expect(announcementDocumentToHtml(parsed!)).toContain("border-radius:50%");
  });

  it("accepts the expanded shape catalog and preserves shapes in generated HTML", () => {
    const document = {
      ...defaultAnnouncementDocument("Shape catalog"),
      elements: ANNOUNCEMENT_SHAPES.filter((shape) => ["star", "hexagon", "arrowRight", "heart", "flowchartDecision"].includes(shape.value)).map((shape, index) => ({
        id: `shape-${shape.value}-${index}`,
        type: "rect" as const,
        shape: shape.value,
        x: 20 + index * 120,
        y: 200,
        width: 100,
        height: 100,
        fill: "#e66f51",
        cornerRadius: 0
      }))
    };
    const parsed = parseAnnouncementDocument(document);
    expect(parsed?.elements.map((element) => element.type === "rect" ? element.shape : undefined)).toEqual(["star", "hexagon", "arrowRight", "heart", "flowchartDecision"]);
    expect(announcementDocumentToHtml(parsed!)).toContain("clip-path:polygon");
  });

  it("preserves table and grid layout metadata across parsing", () => {
    const document = {
      ...defaultAnnouncementDocument("Layouts"),
      elements: [
        {
          id: "grid-cell",
          type: "rect" as const,
          x: 24,
          y: 24,
          width: 400,
          height: 300,
          fill: "#fff",
          cornerRadius: 12,
          container: "grid" as const,
          cellId: "grid-cell-1",
          layoutId: "grid-1",
          layoutType: "grid" as const,
          layoutGap: 18,
          layoutRows: 2,
          layoutColumns: 3,
          cellRow: 1,
          cellColumn: 2
        }
      ]
    };
    const parsed = parseAnnouncementDocument(document);
    expect(parsed?.elements[0]).toMatchObject({
      layoutId: "grid-1",
      layoutRows: 2,
      layoutColumns: 3,
      cellRow: 1,
      cellColumn: 2,
      layoutGap: 18
    });
  });
});
