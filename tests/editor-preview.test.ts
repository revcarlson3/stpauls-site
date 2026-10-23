import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("page editor site preview target", () => {
  it("resolves the edited page path in the shared admin shell", () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), "app/admin/layout.tsx"), "utf8");
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");

    expect(layout).toContain('fetch(`/api/pages/${encodeURIComponent(editorPageMatch[1])}`)');
    expect(layout).toContain('page.isHome ? "/" : `/${encodeURIComponent(page.slug)}`');
    expect(layout).toContain('const publicSiteTarget = publicSiteUrl ? `${publicSiteUrl.replace(/\\/$/, "")}${publicSitePagePath ?? ""}` : null;');
    expect(editor).toContain('new CustomEvent("page-editor-saved"');
  });

  it("continuously measures dynamic insertion zones while dragging", () => {
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");

    expect(editor).toContain("measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}");
    expect(editor).toContain("<DndContext autoScroll={false}");
    expect(editor).toContain("dragStartScrollTopRef.current = canvasRef.current?.scrollTop ?? 0;");
    expect(editor).toContain("overflowAnchor: draggedType || draggedLayerPath ? \"none\" : undefined");
    expect(editor).toContain("className={`relative z-30 h-1 w-full rounded");
    expect(editor).toContain("className=\"pointer-events-none absolute left-1/2 top-1 z-30");
    expect(editor).toContain("const highlightedTarget = activeDropPathRef.current;");
    expect(editor).toContain("const insertionMatch = highlightedTarget?.match(/^insert:(root|[\\d.]+):(\\d+)$/);");
    expect(editor).toContain("next.type === \"grid\" ? normalizeGridTree(next) : next");
    expect(editor).toContain("h-full min-h-32 min-w-0 rounded-lg");
    expect(editor).toContain("const dropHits = pointerWithin({ ...args, droppableContainers: nonInsertionTargets });");
    expect(editor).toContain("const nearestInsert = closestCenter({ ...args, droppableContainers: insertTargets });");
    expect(editor).toContain("const resolvedOver = lastDragOverRef.current ?? over;");
  });

  it("persists image links and exposes expanded image animations", () => {
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");
    const renderer = fs.readFileSync(path.resolve(process.cwd(), "components/page-renderer.tsx"), "utf8");
    const display = fs.readFileSync(path.resolve(process.cwd(), "components/image-display.tsx"), "utf8");

    expect(editor).toContain("imageLinkUrl");
    expect(editor).toContain('placeholder="/about or https://example.com"');
    expect(editor).toContain('value="bounce">Bounce</option>');
    expect(renderer).toContain("linkUrl={typeof block.props.imageLinkUrl === \"string\" ? block.props.imageLinkUrl : \"\"}");
    expect(display).toContain("safeLinkUrl");
    expect(display).toContain('rel={linkTarget === "_blank" ? "noreferrer" : undefined}');
    expect(display).toContain("amount: 0.65");
    expect(display).toContain('from "motion/react"');
    expect(display).toContain("type: \"spring\"");
  });

  it("wires responsive calendar default views into the published calendar", () => {
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");
    const renderer = fs.readFileSync(path.resolve(process.cwd(), "components/page-renderer.tsx"), "utf8");
    const calendar = fs.readFileSync(path.resolve(process.cwd(), "components/public-event-calendar.tsx"), "utf8");

    expect(editor).toContain("calendarDefaultView");
    expect(editor).toContain("Default view on {previewDevice}");
    expect(renderer).toContain('<PublicEventCalendar defaultView={calendarView} />');
    expect(renderer).toContain('responsiveString(block.props ?? {}, "calendarDefaultView", device)');
    expect(calendar).toContain("defaultView = \"month\"");
    expect(calendar).toContain("open ? \"z-40\" : \"z-0\"");
    expect(renderer).toContain("calendar-block-surface");
  });

  it("exposes responsive divider and spacer controls and persistence", () => {
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");
    const blocks = fs.readFileSync(path.resolve(process.cwd(), "lib/blocks.ts"), "utf8");

    expect(blocks).toContain('| "divider"');
    expect(blocks).toContain('| "spacer"');
    expect(editor).toContain('{ label: "Layout elements", types: [...structuralTypes, "divider", "spacer"] }');
    expect(editor).toContain("dividerColor");
    expect(editor).toContain("dividerShape");
    expect(editor).toContain("spacerHeight");
    expect(editor).toContain('type === "divider" ? "#17324d"');
    expect(editor).toContain('type === "spacer" ? "48"');
    expect(editor).toContain('block.type === "divider" &&');
    expect(editor).toContain('block.type === "spacer" &&');
  });

  it("preserves the password during the MFA step and exposes delivery methods", () => {
    const login = fs.readFileSync(path.resolve(process.cwd(), "app/admin/login/page.tsx"), "utf8");

    expect(login).toContain('/api/auth/callback/credentials');
    expect(login).toContain('mfaCode: code');
    expect(login).toContain("password,");
    expect(login).toContain("Verification method");
    expect(login).toContain("Send new code");
    expect(login).toContain("mfaChannels.map");
  });

  it("offers enabled site-wide email and SMS MFA to verified contacts", () => {
    const auth = fs.readFileSync(path.resolve(process.cwd(), "lib/auth-options.ts"), "utf8");

    expect(auth).toContain('settings.emailMfaEnabled && user.emailVerifiedAt ? "email" : ""');
    expect(auth).toContain('settings.smsMfaEnabled && user.phoneVerifiedAt && user.phoneNumber ? "sms" : ""');
  });

  it("uses a shell-free unavailable page for unpublished public routes", () => {
    const page = fs.readFileSync(path.resolve(process.cwd(), "app/(public)/[slug]/page.tsx"), "utf8");

    expect(page).toContain("function PageUnavailable()");
    expect(page).toContain('className="fixed inset-0 z-[100]');
    expect(page).toContain('page.status !== "PUBLISHED"');
    expect(page).toContain("Page not available");
    expect(page).toContain("return { robots: { index: false, follow: false } }");
  });
});
