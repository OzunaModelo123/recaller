import { describe, it, expect } from "vitest";
import {
  evidenceSatisfiesProof,
  normalizeProofType,
  defaultProofForStep,
  isProofType,
} from "./proof";

describe("evidenceSatisfiesProof – completions API logic", () => {
  it("'none' allows empty evidence", () => {
    expect(evidenceSatisfiesProof("none", {})).toBe(true);
    expect(evidenceSatisfiesProof("none", { text: "", url: "" })).toBe(true);
  });

  it("'text' requires non-empty text", () => {
    expect(evidenceSatisfiesProof("text", { text: "" })).toBe(false);
    expect(evidenceSatisfiesProof("text", { text: "   " })).toBe(false);
    expect(evidenceSatisfiesProof("text", { text: "I did it" })).toBe(true);
  });

  it("'link' requires valid HTTP URL", () => {
    expect(evidenceSatisfiesProof("link", { url: "" })).toBe(false);
    expect(evidenceSatisfiesProof("link", { url: "not-a-url" })).toBe(false);
    expect(evidenceSatisfiesProof("link", { url: "ftp://bad.com" })).toBe(false);
    expect(evidenceSatisfiesProof("link", { url: "https://proof.com/doc" })).toBe(true);
    expect(evidenceSatisfiesProof("link", { url: "http://proof.com/doc" })).toBe(true);
  });

  it("'text_and_link' requires both", () => {
    expect(evidenceSatisfiesProof("text_and_link", { text: "done", url: "" })).toBe(false);
    expect(evidenceSatisfiesProof("text_and_link", { text: "", url: "https://x.com" })).toBe(false);
    expect(
      evidenceSatisfiesProof("text_and_link", {
        text: "done",
        url: "https://x.com",
      }),
    ).toBe(true);
  });

  it("'file' accepts storage_path or URL or text", () => {
    expect(evidenceSatisfiesProof("file", {})).toBe(false);
    expect(evidenceSatisfiesProof("file", { storage_path: "uploads/abc.pdf" })).toBe(true);
    expect(evidenceSatisfiesProof("file", { url: "https://files.com/a" })).toBe(true);
    expect(evidenceSatisfiesProof("file", { text: "manual note" })).toBe(true);
  });

  it("'screenshot' works like 'file'", () => {
    expect(evidenceSatisfiesProof("screenshot", {})).toBe(false);
    expect(evidenceSatisfiesProof("screenshot", { storage_path: "s/x.png" })).toBe(true);
  });
});

describe("normalizeProofType", () => {
  it("returns valid types as-is", () => {
    expect(normalizeProofType("none")).toBe("none");
    expect(normalizeProofType("text")).toBe("text");
    expect(normalizeProofType("file")).toBe("file");
  });

  it("returns 'none' for invalid types", () => {
    expect(normalizeProofType("invalid")).toBe("none");
    expect(normalizeProofType(null)).toBe("none");
    expect(normalizeProofType(undefined)).toBe("none");
    expect(normalizeProofType(42)).toBe("none");
  });
});

describe("isProofType", () => {
  it("recognizes all valid proof types", () => {
    expect(isProofType("none")).toBe(true);
    expect(isProofType("text")).toBe(true);
    expect(isProofType("link")).toBe(true);
    expect(isProofType("text_and_link")).toBe(true);
    expect(isProofType("file")).toBe(true);
    expect(isProofType("screenshot")).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isProofType("photo")).toBe(false);
    expect(isProofType("")).toBe(false);
  });
});

describe("defaultProofForStep", () => {
  it("returns 'none' with default instructions for empty input", () => {
    const result = defaultProofForStep();
    expect(result.proof_type).toBe("none");
    expect(result.proof_instructions).toContain("No separate proof");
  });

  it("generates appropriate instructions for 'link' type", () => {
    const result = defaultProofForStep({ proof_type: "link" });
    expect(result.proof_type).toBe("link");
    expect(result.proof_instructions).toContain("Paste a link");
  });

  it("preserves custom instructions", () => {
    const result = defaultProofForStep({
      proof_type: "text",
      proof_instructions: "Write 100 words about what you learned",
    });
    expect(result.proof_instructions).toBe("Write 100 words about what you learned");
  });
});
