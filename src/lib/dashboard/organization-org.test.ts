import { describe, expect, it } from "vitest";
import {
  ORG_LOGO_MAX_BYTES,
  orgLogoObjectPathFromPublicUrl,
  validateLogoFile,
  validateOrgName,
} from "./organization-org";

describe("validateOrgName", () => {
  it("accepts trimmed names within limit", () => {
    expect(validateOrgName("  Acme Corp  ")).toEqual({ ok: true, name: "Acme Corp" });
  });

  it("rejects empty", () => {
    expect(validateOrgName("   ").ok).toBe(false);
  });

  it("rejects too long", () => {
    const long = "a".repeat(121);
    expect(validateOrgName(long).ok).toBe(false);
  });
});

describe("validateLogoFile", () => {
  it("accepts png under limit", () => {
    const file = new File([new Uint8Array(100)], "x.png", { type: "image/png" });
    const r = validateLogoFile(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.extension).toBe("png");
  });

  it("rejects oversized", () => {
    const big = new Uint8Array(ORG_LOGO_MAX_BYTES + 1);
    const file = new File([big], "x.png", { type: "image/png" });
    expect(validateLogoFile(file).ok).toBe(false);
  });

  it("rejects bad mime", () => {
    const file = new File([new Uint8Array(10)], "x.gif", { type: "image/gif" });
    expect(validateLogoFile(file).ok).toBe(false);
  });
});

describe("orgLogoObjectPathFromPublicUrl", () => {
  it("parses Supabase public URL path", () => {
    const url =
      "https://abc.supabase.co/storage/v1/object/public/org-logos/uuid/logo.jpg?x=1";
    expect(orgLogoObjectPathFromPublicUrl(url)).toBe("uuid/logo.jpg");
  });

  it("returns null for invalid", () => {
    expect(orgLogoObjectPathFromPublicUrl(null)).toBe(null);
    expect(orgLogoObjectPathFromPublicUrl("https://example.com/x")).toBe(null);
  });
});
