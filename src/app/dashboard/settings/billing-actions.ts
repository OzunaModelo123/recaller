"use server";

import { redirect } from "next/navigation";

import {
  createCheckoutSession,
  createBillingPortalSession,
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
  const priceId = formData.get("priceId") as string;
  const planTier = formData.get("planTier") as "starter" | "growth";
  const seatCount = parseInt(formData.get("seatCount") as string) || 5;

  const ctx = await requireAdmin();
  if (ctx.error || !ctx.orgId || !ctx.email) {
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
