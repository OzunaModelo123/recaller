"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  AlertTriangle,
  Check,
  Sparkles,
  Users,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const pricingConfigured = Boolean(
    prices.starterPriceId?.trim() && prices.growthPriceId?.trim(),
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Billing</h2>

      {billingResult === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <Check className="mb-1 inline-block h-4 w-4" /> Subscription updated
          successfully.
        </div>
      )}
      {billingResult === "seats_synced" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <Check className="mb-1 inline-block h-4 w-4" /> Billed seats updated to
          match your team size. Changes may take a moment to appear.
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

      {!pricingConfigured && (!sub || sub.status === "cancelled") ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="mb-1 inline-block h-4 w-4" />
          <span className="font-medium"> Stripe Price IDs are not configured.</span>{" "}
          Set <code className="rounded bg-muted px-1 font-mono text-xs">STRIPE_STARTER_PRICE_ID</code>{" "}
          and{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">STRIPE_GROWTH_PRICE_ID</code>{" "}
          in the server environment (see <code className="font-mono text-xs">.env.local.example</code>
          ). Checkout is disabled until both are set.
        </div>
      ) : null}

      {!sub || sub.status === "cancelled" ? (
        <NoPlanView
          prices={prices}
          memberCount={teamMemberCount}
          pricingConfigured={pricingConfigured}
        />
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
  pricingConfigured,
}: {
  prices: BillingPriceConfig;
  memberCount: number;
  pricingConfigured: boolean;
}) {
  const minSeats = Math.max(5, memberCount);
  const [seats, setSeats] = useState(minSeats);

  useEffect(() => {
    setSeats((prev) => Math.max(prev, Math.max(5, memberCount)));
  }, [memberCount]);

  const starterMonthlyTotal = seats * PLANS.starter.pricePerSeat;
  const growthAnnualTotal = seats * PLANS.growth.annualPerSeat;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <Label
          htmlFor="billing-seats"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          Seats to purchase
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Minimum {minSeats} (covers your current team of {memberCount}{" "}
          {memberCount === 1 ? "person" : "people"}). Billed per seat after trial.
        </p>
        <div className="mt-3 flex max-w-xs flex-wrap items-center gap-2">
          <Input
            id="billing-seats"
            type="number"
            min={minSeats}
            max={5000}
            value={seats}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isNaN(v)) return;
              setSeats(Math.min(5000, Math.max(minSeats, v)));
            }}
            className="h-10 w-28"
            disabled={!pricingConfigured}
          />
          <span className="text-sm text-muted-foreground">seats</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["starter", "growth"] as const).map((tier) => {
          const plan = PLANS[tier];
          const priceId =
            tier === "starter" ? prices.starterPriceId : prices.growthPriceId;
          const displayPrice =
            tier === "growth"
              ? `$${plan.pricePerSeat}/seat/mo (billed annually)`
              : `$${plan.pricePerSeat}/seat/mo`;

          const estimateLabel =
            tier === "starter"
              ? `About $${starterMonthlyTotal.toLocaleString()}/mo after trial (${seats} seats × $${plan.pricePerSeat})`
              : `About $${growthAnnualTotal.toLocaleString()}/yr total (${seats}× $${PLANS.growth.annualPerSeat}/yr per seat)`;

          return (
            <div
              key={tier}
              className="relative flex flex-col rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              {tier === "growth" && (
                <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Best value
                </Badge>
              )}
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{plan.tagline}</p>
              <p className="mt-3 text-2xl font-bold text-foreground">{displayPrice}</p>
              <p className="mt-1 text-xs text-muted-foreground">{estimateLabel}</p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                14-day free trial, then billed in Stripe.
              </p>
              <ul className="mt-4 flex-1 space-y-2">
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

              <Button
                type="button"
                className="mt-6 w-full"
                variant={tier === "growth" ? "default" : "outline"}
                disabled={!pricingConfigured}
                onClick={async () => {
                  const { startCheckoutAction } = await import(
                    "@/app/dashboard/settings/billing-actions"
                  );
                  const fd = new FormData();
                  fd.set("priceId", priceId);
                  fd.set("planTier", tier);
                  fd.set("seatCount", String(seats));
                  await startCheckoutAction(fd);
                }}
              >
                Start 14-day free trial
              </Button>
            </div>
          );
        })}
      </div>
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

  const seatsMismatch =
    (sub.status === "active" || sub.status === "trialing") &&
    teamMemberCount !== sub.seat_limit;

  return (
    <div className="space-y-4">
      {seatsMismatch ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-[var(--shadow-card)] dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <div className="flex flex-wrap items-start gap-2">
            <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Team size and billed seats differ</p>
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                You have {teamMemberCount} team {teamMemberCount === 1 ? "member" : "members"} but{" "}
                {sub.seat_limit} billed {sub.seat_limit === 1 ? "seat" : "seats"}. Sync to update
                Stripe (prorated) or use Manage billing to adjust.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={async () => {
                    const { syncSubscriptionSeatsToTeamAction } = await import(
                      "@/app/dashboard/settings/billing-actions"
                    );
                    await syncSubscriptionSeatsToTeamAction();
                  }}
                >
                  Sync seats to team size
                </Button>
                {sub.stripe_customer_id ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={async () => {
                      const { manageBillingAction } = await import(
                        "@/app/dashboard/settings/billing-actions"
                      );
                      await manageBillingAction();
                    }}
                  >
                    Manage billing
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <Badge variant={isTrialing ? "secondary" : "default"}>
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
            <p className="text-xs text-muted-foreground">Seats used</p>
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
            <p className="text-xs text-muted-foreground">Next billing</p>
            <p className="text-lg font-semibold text-foreground">{nextBilling}</p>
          </div>
        </div>

        {sub.stripe_customer_id && (
          <form className="mt-4">
            <Button
              type="submit"
              variant="outline"
              className="rounded-xl"
              formAction={async () => {
                const { manageBillingAction } = await import(
                  "@/app/dashboard/settings/billing-actions"
                );
                await manageBillingAction();
              }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage billing
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function PastDueView({ sub }: { sub: NonNullable<Subscription> }) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-6 shadow-[var(--shadow-card)] dark:border-red-800 dark:bg-red-950">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
          Payment failed
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
            className="rounded-xl"
            formAction={async () => {
              const { manageBillingAction } = await import(
                "@/app/dashboard/settings/billing-actions"
              );
              await manageBillingAction();
            }}
          >
            Update payment method
          </Button>
        </form>
      )}
    </div>
  );
}
