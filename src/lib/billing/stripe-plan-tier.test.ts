import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planTierFromStripePriceId } from "./stripe";

describe("planTierFromStripePriceId", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter_test");
    vi.stubEnv("STRIPE_GROWTH_PRICE_ID", "price_growth_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps starter price id", () => {
    expect(planTierFromStripePriceId("price_starter_test")).toBe("starter");
  });

  it("maps growth price id", () => {
    expect(planTierFromStripePriceId("price_growth_test")).toBe("growth");
  });

  it("returns null for unknown price", () => {
    expect(planTierFromStripePriceId("price_unknown")).toBe(null);
  });

  it("returns null for empty", () => {
    expect(planTierFromStripePriceId("")).toBe(null);
    expect(planTierFromStripePriceId(null)).toBe(null);
  });
});
