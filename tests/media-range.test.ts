import { describe, expect, it } from "vitest";
import { parseMediaByteRange } from "@/lib/media";

describe("media byte ranges", () => {
  it("parses an open-ended range", () => {
    expect(parseMediaByteRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 });
  });

  it("parses and clamps a bounded range", () => {
    expect(parseMediaByteRange("bytes=10-2000", 1000)).toEqual({ start: 10, end: 999 });
  });

  it("parses a suffix range", () => {
    expect(parseMediaByteRange("bytes=-250", 1000)).toEqual({ start: 750, end: 999 });
  });

  it("rejects unsatisfiable ranges", () => {
    expect(parseMediaByteRange("bytes=1000-", 1000)).toBeNull();
    expect(parseMediaByteRange("bytes=20-10", 1000)).toBeNull();
  });

  it("returns undefined when no range was requested", () => {
    expect(parseMediaByteRange(null, 1000)).toBeUndefined();
  });
});
