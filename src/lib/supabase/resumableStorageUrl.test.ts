import { afterEach, describe, expect, it, vi } from "vitest";

import { getResumableUploadEndpoint } from "./resumableStorageUrl";

describe("getResumableUploadEndpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps default Supabase project URL to storage host", () => {
    expect(
      getResumableUploadEndpoint("https://abcdefghijklmnop.supabase.co"),
    ).toBe(
      "https://abcdefghijklmnop.storage.supabase.co/storage/v1/upload/resumable",
    );
  });

  it("leaves an existing storage host unchanged", () => {
    expect(
      getResumableUploadEndpoint(
        "https://abcdefghijklmnop.storage.supabase.co",
      ),
    ).toBe(
      "https://abcdefghijklmnop.storage.supabase.co/storage/v1/upload/resumable",
    );
  });

  it("uses NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL when set", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL",
      "https://custom.example/storage/v1/upload/resumable",
    );
    expect(getResumableUploadEndpoint("https://ignored.supabase.co")).toBe(
      "https://custom.example/storage/v1/upload/resumable",
    );
  });

  it("uses NEXT_PUBLIC_SUPABASE_PROJECT_REF for custom API hostnames", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PROJECT_REF", "abcdefghijklmnop");
    expect(getResumableUploadEndpoint("https://db.mycompany.com")).toBe(
      "https://abcdefghijklmnop.storage.supabase.co/storage/v1/upload/resumable",
    );
  });

  it("throws when custom hostname has no ref or override", () => {
    expect(() =>
      getResumableUploadEndpoint("https://db.mycompany.com"),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PROJECT_REF/);
  });
});
