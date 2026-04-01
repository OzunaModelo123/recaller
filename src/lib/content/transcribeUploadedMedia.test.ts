import { describe, expect, it } from "vitest";

import { canTranscribeUploadedAssetDirectly } from "./transcribeUploadedMedia";

describe("canTranscribeUploadedAssetDirectly", () => {
  it("rejects browser-recorded webm audio chunks so they get normalized first", () => {
    expect(
      canTranscribeUploadedAssetDirectly({
        path: "org/item/transcript-audio/001-demo.part-001.webm",
        contentType: "audio/webm;codecs=opus",
      }),
    ).toBe(false);
  });

  it("allows known Whisper-friendly audio formats through directly", () => {
    expect(
      canTranscribeUploadedAssetDirectly({
        path: "org/item/transcript-audio/001-demo.part-001.mp3",
        contentType: "audio/mpeg",
      }),
    ).toBe(true);

    expect(
      canTranscribeUploadedAssetDirectly({
        path: "org/item/transcript-audio/001-demo.part-001.m4a",
        contentType: "audio/mp4",
      }),
    ).toBe(true);
  });
});
