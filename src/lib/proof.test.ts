import { describe, expect, it } from "vitest";

import {
  defaultProofForStep,
  evidenceSatisfiesProof,
  normalizeProofType,
} from "./proof";

describe("normalizeProofType", () => {
  it("returns known types unchanged", () => {
    expect(normalizeProofType("link")).toBe("link");
    expect(normalizeProofType("none")).toBe("none");
  });

  it("falls back to none for invalid or missing values (safe DB enum)", () => {
    expect(normalizeProofType("bogus")).toBe("none");
    expect(normalizeProofType(null)).toBe("none");
  });
});

describe("defaultProofForStep", () => {
  it("fills default instructions for none", () => {
    const p = defaultProofForStep({ proof_type: "none", proof_instructions: "" });
    expect(p.proof_type).toBe("none");
    expect(p.proof_instructions).toContain("No separate proof");
  });
});

describe("evidenceSatisfiesProof", () => {
  it("none always passes", () => {
    expect(evidenceSatisfiesProof("none", {})).toBe(true);
  });

  it("text requires non-empty text", () => {
    expect(evidenceSatisfiesProof("text", {})).toBe(false);
    expect(evidenceSatisfiesProof("text", { text: "  ok  " })).toBe(true);
  });

  it("link requires http(s) URL", () => {
    expect(evidenceSatisfiesProof("link", { url: "not-a-url" })).toBe(false);
    expect(evidenceSatisfiesProof("link", { url: "https://example.com" })).toBe(
      true,
    );
  });

  it("text_and_link requires both", () => {
    expect(
      evidenceSatisfiesProof("text_and_link", {
        text: "x",
        url: "https://a.com",
      }),
    ).toBe(true);
    expect(
      evidenceSatisfiesProof("text_and_link", { text: "x" }),
    ).toBe(false);
  });

  it("file accepts text, url, or storage_path", () => {
    expect(evidenceSatisfiesProof("file", { text: "x" })).toBe(true);
    expect(evidenceSatisfiesProof("file", { url: "https://x.com" })).toBe(true);
    expect(evidenceSatisfiesProof("file", { storage_path: "org/x" })).toBe(true);
    expect(evidenceSatisfiesProof("file", {})).toBe(false);
  });
});
