import { expect, test } from "@playwright/test";

/**
 * Contract smoke tests for POST /api/plans/generate (no AI calls).
 * Full generation requires auth, ready content, and API keys — covered manually or in staging.
 */
test.describe("POST /api/plans/generate", () => {
  test("returns 401 without session", async ({ request }) => {
    const res = await request.post("/api/plans/generate", {
      data: { contentItemId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(res.status()).toBe(401);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBeTruthy();
  });

  test("returns 400 when contentItemId is missing", async ({ request }) => {
    const res = await request.post("/api/plans/generate", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 for invalid JSON body", async ({ request }) => {
    const res = await request.post("/api/plans/generate", {
      headers: { "Content-Type": "application/json" },
      data: "{",
    });
    expect(res.status()).toBe(400);
  });
});
