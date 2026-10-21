import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("page editor save concurrency", () => {
  it("waits for an in-flight autosave before sending a manual save", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");

    expect(source).toContain("const pendingAutosaves = Array.from(autosavePromisesRef.current);");
    expect(source).toContain("if (pendingAutosaves.length > 0) await Promise.all(pendingAutosaves);");
    expect(source).toContain("if (typeof result.updatedAt === \"string\") serverUpdatedAtRef.current = result.updatedAt;");
  });

  it("runs autosaves on a one-minute interval instead of after each edit", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");

    expect(source).toContain("window.setInterval(() => {");
    expect(source).toContain("}, 60_000);");
    expect(source).toContain("if (!editorDirtyRef.current || !input) return;");
    expect(source).not.toContain("}, 900);");
  });
});
