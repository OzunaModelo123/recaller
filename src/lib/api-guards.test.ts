import { describe, it, expect } from "vitest";
import { checkPlanGenerationRateLimit } from "./api-guards";

describe("checkPlanGenerationRateLimit", () => {
  it("allows the first request", () => {
    const result = checkPlanGenerationRateLimit("user-test-1", "org-test-1");
    expect(result.allowed).toBe(true);
  });

  it("allows requests within the limit", () => {
    const userId = "user-rate-test-2";
    const orgId = "org-rate-test-2";

    for (let i = 0; i < 9; i++) {
      const r = checkPlanGenerationRateLimit(userId, orgId);
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks after user limit (10)", () => {
    const userId = "user-rate-test-3";
    const orgId = "org-rate-test-3";

    for (let i = 0; i < 10; i++) {
      checkPlanGenerationRateLimit(userId, orgId);
    }

    const result = checkPlanGenerationRateLimit(userId, orgId);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("per hour");
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("different users have separate buckets", () => {
    const orgId = "org-rate-separate";
    // Even though user A hit the limit
    for (let i = 0; i < 10; i++) {
      checkPlanGenerationRateLimit("user-rateA", orgId);
    }
    // User B should still be fine
    const result = checkPlanGenerationRateLimit("user-rateB", orgId);
    expect(result.allowed).toBe(true);
  });
});
