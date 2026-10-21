import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("membership directory family photographs", () => {
  it("uses browser image elements for protected family photo URLs", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "app/admin/membership/membership-directory.tsx"), "utf8");

    expect(source).toContain('<img src={photoUrl}');
    expect(source).not.toContain('from "next/image"');
  });
});
