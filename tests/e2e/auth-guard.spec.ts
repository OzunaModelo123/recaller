import { expect, test } from "@playwright/test";

test.describe("auth guards", () => {
  test("unauthenticated user cannot open employee setup-password", async ({
    page,
  }) => {
    await page.goto("/employee/setup-password");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot open employee my-plans", async ({ page }) => {
    await page.goto("/employee/my-plans");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot open dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
