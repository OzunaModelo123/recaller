import { describe, expect, it } from "vitest";

import { sanitizedPostgrestError } from "./sanitized-error";

function pgErr(overrides: Partial<{ code: string; message: string }>) {
  return {
    code: overrides.code ?? "PGRST000",
    message: overrides.message ?? "internal detail",
    details: "",
    hint: "",
    name: "PostgrestError",
  };
}

describe("sanitizedPostgrestError", () => {
  it("returns friendly duplicate message for 23505", () => {
    expect(sanitizedPostgrestError(pgErr({ code: "23505" }))).toContain(
      "already exists",
    );
  });

  it("returns friendly FK message for 23503", () => {
    expect(sanitizedPostgrestError(pgErr({ code: "23503" }))).toContain(
      "related record",
    );
  });

  it("hides raw PostgREST messages for other codes", () => {
    expect(sanitizedPostgrestError(pgErr({ code: "42P01" }))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(sanitizedPostgrestError(pgErr({ code: "42P01" }))).not.toContain(
      "internal detail",
    );
  });
});
