import { describe, expect, it } from "vitest";
import { gridCellLabel, moveBlockToInsertion, type EditorTreeNode } from "@/lib/editor-tree";

type Node = EditorTreeNode & { id: string };

const node = (id: string, type = "text", children?: Node[]): Node => ({ id, type, children });

describe("moveBlockToInsertion", () => {
  const structuralTypes = ["container", "flex", "grid"];

  it("moves a nested layer into another container", () => {
    const blocks = [
      node("left", "container", [node("headline")]),
      node("right", "container"),
    ];

    const result = moveBlockToInsertion(blocks, [0, 0], [1], 0, structuralTypes);

    expect(result.path).toEqual([1, 0]);
    expect(result.blocks[0].children).toEqual([]);
    expect((result.blocks[1].children as Node[]).map((item) => item.id)).toEqual(["headline"]);
  });

  describe("gridCellLabel", () => {
    it("identifies both row and column for grid cells", () => {
      expect([0, 1, 2, 3, 4].map((index) => gridCellLabel(index, 2))).toEqual([
        "Row 1, Column 1",
        "Row 1, Column 2",
        "Row 2, Column 1",
        "Row 2, Column 2",
        "Row 3, Column 1",
      ]);
    });
  });

  it("moves a nested layer to the root without changing unrelated paths", () => {
    const blocks = [
      node("first", "container", [node("headline")]),
      node("second", "container"),
    ];

    const result = moveBlockToInsertion(blocks, [0, 0], [], 2, structuralTypes);

    expect(result.path).toEqual([2]);
    expect(result.blocks.map((item) => item.id)).toEqual(["first", "second", "headline"]);
  });

  it("rejects dropping a layer into its own descendant", () => {
    const blocks = [node("outer", "container", [node("inner", "container")])];

    const result = moveBlockToInsertion(blocks, [0], [0, 0], 0, structuralTypes);

    expect(result.blocks).toBe(blocks);
    expect(result.path).toEqual([0]);
  });

  it("reorders siblings while accounting for removal", () => {
    const blocks = [node("one"), node("two"), node("three")];

    const result = moveBlockToInsertion(blocks, [0], [], 3, structuralTypes);

    expect(result.path).toEqual([2]);
    expect(result.blocks.map((item) => item.id)).toEqual(["two", "three", "one"]);
  });
});
