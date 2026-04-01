import { describe, expect, it } from "vitest";

import { shouldOptimizeMediaForTranscript } from "./clientMediaOptimizer";

describe("shouldOptimizeMediaForTranscript", () => {
  it("keeps mp3 uploads on the direct-to-storage path", () => {
    const file = new File(["audio"], "demo.mp3", { type: "audio/mpeg" });
    expect(shouldOptimizeMediaForTranscript(file)).toBe(false);
  });

  it("keeps mp4 uploads on the transcript-audio path", () => {
    const file = new File(["video"], "demo.mp4", { type: "video/mp4" });
    expect(shouldOptimizeMediaForTranscript(file)).toBe(true);
  });
});
