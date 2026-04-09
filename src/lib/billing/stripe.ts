import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

export const PLANS = {
  starter: {
    name: "Recaller Starter",
    pricePerSeat: 25,
    interval: "month" as const,
    tagline: "Small teams getting started with AI training plans.",
    features: [
      "Unlimited training plans",
      "AI plan generation",
      "Slack & Teams delivery",
      "Basic analytics",
      "Email notifications",
    ],
  },
  growth: {
    name: "Recaller Growth",
    pricePerSeat: 20,
    interval: "year" as const,
    annualPerSeat: 240,
    tagline: "Growing orgs that want deeper analytics and insight reports.",
    features: [
      "Everything in Starter",
      "Monthly AI insight reports",
      "Advanced analytics",
      "Priority support",
    ],
  },
} as const;

export type PlanTierKey = keyof typeof PLANS;

/**
 * Maps a Stripe Price id (from subscription line items) to our plan tier.
 * Used when customers change plans in the Billing Portal so `plan_tier` stays in sync.
 */
export function planTierFromStripePriceId(
  priceId: string | undefined | null,
): PlanTierKey | null {
  if (!priceId?.trim()) return null;
  const starter = process.env.STRIPE_STARTER_PRICE_ID?.trim();
  const growth = process.env.STRIPE_GROWTH_PRICE_ID?.trim();
  if (starter && priceId === starter) return "starter";
  if (growth && priceId === growth) return "growth";
  return null;
}

export async function createCheckoutSession(params: {
  orgId: string;
  priceId: string;
  seatCount: number;
  userEmail: string;
  planTier: "starter" | "growth";
}): Promise<string> {
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: params.seatCount }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { orgId: params.orgId, planTier: params.planTier },
    },
    customer_email: params.userEmail,
    success_url: `${appUrl}/dashboard/settings?billing=success`,
    cancel_url: `${appUrl}/dashboard/settings?billing=cancelled`,
    metadata: { orgId: params.orgId, planTier: params.planTier },
  });

  if (!session.url) throw new Error("Stripe session URL is null");
  return session.url;
}

export async function createBillingPortalSession(
  stripeCustomerId: string,
): Promise<string> {
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/dashboard/settings`,
  });

  return session.url;
}

export async function updateSeatCount(
  stripeSubscriptionId: string,
  newSeatCount: number,
): Promise<void> {
  const stripe = getStripe();
  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item) throw new Error("Subscription has no items");

  await stripe.subscriptionItems.update(item.id, {
    quantity: newSeatCount,
    proration_behavior: "create_prorations",
  });
}
