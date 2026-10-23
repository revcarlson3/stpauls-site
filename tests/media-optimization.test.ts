import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImageBuffer } from "@/lib/media";

describe("media image optimization", () => {
  it("reduces supported JPEG files without changing their dimensions", async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 180, g: 120, b: 80 }
      }
    }).jpeg({ quality: 100 }).toBuffer();

    const optimized = await optimizeImageBuffer(source, "image/jpeg");

    expect(optimized).not.toBeNull();
    expect(optimized!.length).toBeLessThan(source.length);
    await expect(sharp(optimized!).metadata()).resolves.toMatchObject({ width: 1600, height: 1200, format: "jpeg" });
  });

  it("does not rewrite GIF files", async () => {
    await expect(optimizeImageBuffer(Buffer.from("gif"), "image/gif")).resolves.toBeNull();
  });
});
