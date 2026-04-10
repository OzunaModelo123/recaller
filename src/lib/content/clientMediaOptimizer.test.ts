import { describe, expect, it } from "vitest";

import { shouldOptimizeMediaForTranscript } from "./clientMediaOptimizer";

describe("shouldOptimizeMediaForTranscript", () => {
  it("keeps mp3 uploads on the direct-to-storage path", () => {
    const file = new File(["audio"], "demo.mp3", { type: "audio/mpeg" });
    expect(shouldOptimizeMediaForTranscript(file)).toBe(false);
  });

  it("optimizes large mp4 uploads via transcript-audio path", () => {
    // Create a file stub that reports a size above the 25 MB bypass threshold
    const largeFile = new File(["video"], "demo.mp4", { type: "video/mp4" });
    Object.defineProperty(largeFile, "size", { value: 30 * 1024 * 1024 });
    expect(shouldOptimizeMediaForTranscript(largeFile)).toBe(true);
  });

  it("bypasses optimization for small mp4 files (< 25 MB) — Whisper accepts them directly", () => {
    const smallFile = new File(["video"], "demo.mp4", { type: "video/mp4" });
    // Default File size from content is ~5 bytes, well under 25 MB
    expect(shouldOptimizeMediaForTranscript(smallFile)).toBe(false);
  });
});
