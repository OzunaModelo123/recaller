import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripe, planTierFromStripePriceId } from "@/lib/billing/stripe";
import { subscriptionIdFromInvoice } from "@/lib/billing/stripe-invoice";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    default:
      return "cancelled";
  }
}

function extractPeriodEnd(sub: Stripe.Subscription): string | null {
  const periodEndSec = (sub as { current_period_end?: number })
    .current_period_end;
  if (typeof periodEndSec === "number" && periodEndSec > 0) {
    return new Date(periodEndSec * 1000).toISOString();
  }
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000).toISOString();
  if (sub.billing_cycle_anchor) {
    const anchor = new Date(sub.billing_cycle_anchor * 1000);
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + 1);
    if (next.getTime() < Date.now()) {
      next.setMonth(new Date().getMonth() + 1);
      next.setFullYear(new Date().getFullYear());
    }
    return next.toISOString();
  }
  return null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const sb = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const planTier = session.metadata?.planTier ?? "starter";
      if (!orgId) break;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      if (!subscriptionId || !customerId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId) as unknown as Stripe.Subscription;
      const quantity = sub.items.data[0]?.quantity ?? 1;
      const trialEnd = sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null;
      const periodEnd = extractPeriodEnd(sub);

      await sb.from("subscriptions").upsert(
        {
          org_id: orgId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan_tier: planTier,
          seat_count: quantity,
          seat_limit: quantity,
          status: sub.status === "trialing" ? "trialing" : "active",
          trial_ends_at: trialEnd,
          current_period_end: periodEnd,
        },
        { onConflict: "org_id" },
      );
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const quantity = sub.items.data[0]?.quantity ?? 1;
      const periodEnd = extractPeriodEnd(sub);
      const status = mapStatus(sub.status);
      const priceId = sub.items.data[0]?.price?.id;
      const planTier = planTierFromStripePriceId(priceId);

      const patch: Record<string, unknown> = {
        status,
        seat_count: quantity,
        seat_limit: quantity,
        current_period_end: periodEnd,
      };
      if (planTier) patch.plan_tier = planTier;

      const orgId = sub.metadata?.orgId;
      if (orgId) {
        await sb.from("subscriptions").update(patch).eq("org_id", orgId);
      } else {
        const { data: row } = await sb
          .from("subscriptions")
          .select("org_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (row) {
          await sb.from("subscriptions").update(patch).eq("org_id", row.org_id);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: row } = await sb
        .from("subscriptions")
        .select("org_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();

      if (row) {
        await sb
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("org_id", row.org_id);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(invoice);

      if (subId) {
        const { data: row } = await sb
          .from("subscriptions")
          .select("org_id")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();

        if (row) {
          await sb
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("org_id", row.org_id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
