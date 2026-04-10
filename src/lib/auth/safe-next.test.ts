import { describe, it, expect } from "vitest";
import { sanitizeInternalNext } from "./safe-next";

describe("sanitizeInternalNext", () => {
  it("returns fallback for null/undefined/empty input", () => {
    expect(sanitizeInternalNext(null)).toBe("/post-login");
    expect(sanitizeInternalNext(undefined)).toBe("/post-login");
    expect(sanitizeInternalNext("")).toBe("/post-login");
    expect(sanitizeInternalNext("  ")).toBe("/post-login");
  });

  it("accepts valid internal paths", () => {
    expect(sanitizeInternalNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeInternalNext("/employee/my-plans")).toBe("/employee/my-plans");
    expect(sanitizeInternalNext("/dashboard/settings?tab=billing")).toBe(
      "/dashboard/settings?tab=billing",
    );
  });

  it("blocks protocol-relative URLs", () => {
    expect(sanitizeInternalNext("//evil.com")).toBe("/post-login");
    expect(sanitizeInternalNext("///evil.com")).toBe("/post-login");
  });

  it("blocks encoded protocol-relative URLs", () => {
    expect(sanitizeInternalNext("/%2f/evil.com")).toBe("/post-login");
    expect(sanitizeInternalNext("/%2F%2Fevil.com")).toBe("/post-login");
  });

  it("blocks backslash-based attacks", () => {
    expect(sanitizeInternalNext("/\\evil.com")).toBe("/post-login");
    expect(sanitizeInternalNext("/%5Cevil.com")).toBe("/post-login");
  });

  it("blocks path traversal", () => {
    expect(sanitizeInternalNext("/../../../etc/passwd")).toBe("/post-login");
    expect(sanitizeInternalNext("/foo/..")).toBe("/post-login");
  });

  it("blocks userinfo patterns", () => {
    expect(sanitizeInternalNext("/login@evil.com/")).toBe("/post-login");
  });

  it("blocks null bytes", () => {
    expect(sanitizeInternalNext("/dashboard\0")).toBe("/post-login");
  });

  it("rejects malformed URI encoding", () => {
    expect(sanitizeInternalNext("/%ZZ")).toBe("/post-login");
  });

  it("uses custom fallback when provided", () => {
    expect(sanitizeInternalNext(null, "/custom")).toBe("/custom");
    expect(sanitizeInternalNext("//evil.com", "/custom")).toBe("/custom");
  });
});
