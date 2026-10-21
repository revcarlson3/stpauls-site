import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("menu editor drag ordering", () => {
  it("uses sortable drag handles and horizontal reparenting instead of arrow buttons", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/menu-editor.tsx"), "utf8");

    expect(source).toContain("DndContext");
    expect(source).toContain("SortableContext");
    expect(source).toContain("useSortable");
    expect(source).toContain("event.delta.x / 32");
    expect(source).toContain("Parent items carry their children with them.");
    expect(source).not.toContain("onClick={() => moveItem");
  });
});
