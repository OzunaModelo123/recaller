"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createCheckoutSession,
  createBillingPortalSession,
  updateSeatCount,
} from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, orgId: null, email: null };

  const { data: me } = await supabase
    .from("users")
    .select("org_id, role, email")
    .eq("id", user.id)
    .single();

  if (!me?.org_id || (me.role !== "admin" && me.role !== "super_admin")) {
    return { error: "Forbidden" as const, orgId: null, email: null };
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", me.org_id)
    .maybeSingle();

  return { error: null, orgId: me.org_id, email: me.email, stripeCustomerId: sub?.stripe_customer_id };
}

export async function startCheckoutAction(formData: FormData) {
  const priceId = (formData.get("priceId") as string)?.trim() ?? "";
  const planTier = formData.get("planTier") as "starter" | "growth";
  const seatCount = parseInt(formData.get("seatCount") as string, 10) || 5;

  const ctx = await requireAdmin();
  if (ctx.error || !ctx.orgId || !ctx.email) {
    return redirect("/dashboard/settings?billing=error");
  }

  if (!priceId) {
    console.error("[Billing] Missing STRIPE_*_PRICE_ID for selected plan");
    return redirect("/dashboard/settings?billing=error");
  }

  try {
    const url = await createCheckoutSession({
      orgId: ctx.orgId,
      priceId,
      seatCount,
      userEmail: ctx.email,
      planTier,
    });
    return redirect(url);
  } catch (e) {
    console.error("[Billing] Checkout session creation failed", e);
    return redirect("/dashboard/settings?billing=error");
  }
}

export async function manageBillingAction() {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.stripeCustomerId) {
    return redirect("/dashboard/settings?billing=error");
  }

  try {
    const url = await createBillingPortalSession(ctx.stripeCustomerId);
    return redirect(url);
  } catch (e) {
    console.error("[Billing] Portal session creation failed", e);
    return redirect("/dashboard/settings?billing=error");
  }
}

/**
 * Updates Stripe subscription quantity to match current org member count (proration).
 * Use when team size and billed seats have diverged.
 */
export async function syncSubscriptionSeatsToTeamAction() {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.orgId) {
    return redirect("/dashboard/settings?billing=error");
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (!row?.stripe_subscription_id) {
    return redirect("/dashboard/settings?billing=error");
  }

  if (row.status !== "active" && row.status !== "trialing") {
    return redirect("/dashboard/settings?billing=error");
  }

  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.orgId);
  const nextQty = Math.max(count ?? 0, 1);

  try {
    await updateSeatCount(row.stripe_subscription_id, nextQty);
  } catch (e) {
    console.error("[Billing] syncSubscriptionSeatsToTeamAction", e);
    return redirect("/dashboard/settings?billing=error");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return redirect("/dashboard/settings?billing=seats_synced");
}
