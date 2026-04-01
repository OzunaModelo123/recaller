"use client";

import { CreditCard, AlertTriangle, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/billing/stripe";

type Subscription = {
  plan_tier: string;
  status: string;
  seat_count: number;
  seat_limit: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
} | null;

type BillingPriceConfig = {
  starterPriceId: string;
  growthPriceId: string;
};

type Props = {
  subscription: Subscription;
  teamMemberCount: number;
  prices: BillingPriceConfig;
  billingResult: string | null;
};

export function BillingSection({
  subscription,
  teamMemberCount,
  prices,
  billingResult,
}: Props) {
  const sub = subscription;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Billing</h2>

      {billingResult === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <Check className="mb-1 inline-block h-4 w-4" /> Subscription updated
          successfully.
        </div>
      )}
      {billingResult === "cancelled" && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          Checkout was cancelled. You can try again anytime.
        </div>
      )}
      {billingResult === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertTriangle className="mb-1 inline-block h-4 w-4" /> Something went
          wrong. Please try again.
        </div>
      )}

      {!sub || sub.status === "cancelled" ? (
        <NoPlanView prices={prices} memberCount={teamMemberCount} />
      ) : sub.status === "past_due" ? (
        <PastDueView sub={sub} />
      ) : (
        <ActivePlanView
          sub={sub}
          teamMemberCount={teamMemberCount}
        />
      )}
    </div>
  );
}

function NoPlanView({
  prices,
  memberCount,
}: {
  prices: BillingPriceConfig;
  memberCount: number;
}) {
  const seatCount = Math.max(memberCount, 5);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(["starter", "growth"] as const).map((tier) => {
        const plan = PLANS[tier];
        const priceId =
          tier === "starter" ? prices.starterPriceId : prices.growthPriceId;
        const displayPrice =
          tier === "growth"
            ? `$${plan.pricePerSeat}/seat/mo (billed annually)`
            : `$${plan.pricePerSeat}/seat/mo`;

        return (
          <div
            key={tier}
            className="relative rounded-xl border border-border bg-card p-6"
          >
            {tier === "growth" && (
              <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground">
                <Sparkles className="mr-1 h-3 w-3" />
                Best Value
              </Badge>
            )}
            <h3 className="text-lg font-semibold text-foreground">
              {plan.name}
            </h3>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {displayPrice}
            </p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>

            <form
              action="/dashboard/settings/billing-actions"
              method="POST"
              className="mt-6"
            >
              <input type="hidden" name="priceId" value={priceId} />
              <input type="hidden" name="planTier" value={tier} />
              <input
                type="hidden"
                name="seatCount"
                value={String(seatCount)}
              />
              <Button
                type="submit"
                formAction={async () => {
                  const { startCheckoutAction } = await import(
                    "@/app/dashboard/settings/billing-actions"
                  );
                  const fd = new FormData();
                  fd.set("priceId", priceId);
                  fd.set("planTier", tier);
                  fd.set("seatCount", String(seatCount));
                  await startCheckoutAction(fd);
                }}
                className="w-full"
                variant={tier === "growth" ? "default" : "outline"}
              >
                Start 14-Day Free Trial
              </Button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

function ActivePlanView({
  sub,
  teamMemberCount,
}: {
  sub: NonNullable<Subscription>;
  teamMemberCount: number;
}) {
  const plan = PLANS[sub.plan_tier as keyof typeof PLANS] ?? PLANS.starter;
  const isTrialing = sub.status === "trialing";
  const trialDaysLeft =
    isTrialing && sub.trial_ends_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(sub.trial_ends_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;
  const nextBilling = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              {plan.name}
            </h3>
            <Badge
              variant={isTrialing ? "secondary" : "default"}
            >
              {isTrialing ? "Trial" : "Active"}
            </Badge>
          </div>

          {isTrialing && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining in
              trial
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Seats Used</p>
          <p className="text-lg font-semibold text-foreground">
            {teamMemberCount} / {sub.seat_limit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Plan</p>
          <p className="text-lg font-semibold text-foreground capitalize">
            {sub.plan_tier}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Next Billing</p>
          <p className="text-lg font-semibold text-foreground">{nextBilling}</p>
        </div>
      </div>

      {sub.stripe_customer_id && (
        <form className="mt-4">
          <Button
            type="submit"
            variant="outline"
            formAction={async () => {
              const { manageBillingAction } = await import(
                "@/app/dashboard/settings/billing-actions"
              );
              await manageBillingAction();
            }}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
        </form>
      )}
    </div>
  );
}

function PastDueView({ sub }: { sub: NonNullable<Subscription> }) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
          Payment Failed
        </h3>
      </div>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">
        Your last payment failed. Please update your payment method to continue
        using Recaller.
      </p>
      {sub.stripe_customer_id && (
        <form className="mt-4">
          <Button
            type="submit"
            variant="destructive"
            formAction={async () => {
              const { manageBillingAction } = await import(
                "@/app/dashboard/settings/billing-actions"
              );
              await manageBillingAction();
            }}
          >
            Update Payment Method
          </Button>
        </form>
      )}
    </div>
  );
}
