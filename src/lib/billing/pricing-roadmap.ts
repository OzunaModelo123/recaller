/**
 * Product roadmap for monetization (Phase C–D). Not wired to Stripe until Price IDs exist.
 *
 * Current production: per-seat Starter (monthly) and Growth (annual) — see PLANS in stripe.ts.
 *
 * Future directions (from revenue plan):
 * - Hybrid: included AI plan generations per tier + optional metered overage or top-up products.
 * - Third paid tier (e.g. Scale) or Enterprise contact for SSO, SLA, higher limits.
 * - Optional: both tiers offered monthly and annual with separate Stripe Prices.
 *
 * When adding a new tier:
 * 1. Create Product + recurring Price in Stripe Dashboard.
 * 2. Add STRIPE_*_PRICE_ID to Vercel env.
 * 3. Extend PlanTierKey / planTierFromStripePriceId / PLANS / BillingSection.
 * 4. Run DB migration only if subscriptions.plan_tier CHECK must include new value (see migrations).
 */

export const FUTURE_OPTIONAL_ENV = {
  /** Metered price for AI overage (when implemented). */
  stripeAiOveragePriceId: "STRIPE_AI_OVERAGE_PRICE_ID",
  /** Third self-serve tier (when implemented). */
  stripeScalePriceId: "STRIPE_SCALE_PRICE_ID",
} as const;
