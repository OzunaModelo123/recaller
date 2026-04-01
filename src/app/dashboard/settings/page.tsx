import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Plug } from "lucide-react";

import { EMPTY_ORG_CONTEXT } from "@/lib/ai/orgContext";
import { CompanyContextSettingsPanel } from "@/components/dashboard/company-context-forms";
import { AdminIntegrationsGrid } from "@/components/dashboard/admin-integrations-grid";
import { BillingSection } from "@/components/dashboard/billing-section";
import { Button } from "@/components/ui/button";
import { loadAdminIntegrationsForUser } from "@/lib/dashboard/load-admin-integrations";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ slack?: string; reason?: string; billing?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const integrationsData =
    isAdmin && user ? await loadAdminIntegrationsForUser(supabase, user.id) : null;

  const initial = integrationsData?.initialOrgContext ?? EMPTY_ORG_CONTEXT;

  let subscription = null;
  let teamMemberCount = 0;
  if (isAdmin && profile?.org_id) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "plan_tier, status, seat_count, seat_limit, trial_ends_at, current_period_end, stripe_customer_id",
      )
      .eq("org_id", profile.org_id)
      .maybeSingle();
    subscription = sub;

    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id);
    teamMemberCount = count ?? 0;
  }

  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID ?? "";
  const growthPriceId = process.env.STRIPE_GROWTH_PRICE_ID ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Settings
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Organization settings, integrations, and billing.
        </p>
      </div>

      {isAdmin && <CompanyContextSettingsPanel initial={initial} />}

      {isAdmin && integrationsData ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/integrations">
                <Plug className="mr-2 h-4 w-4" />
                Open integrations hub
              </Link>
            </Button>
          </div>
          <AdminIntegrationsGrid
            data={integrationsData}
            slackResult={params.slack ?? null}
            slackReason={params.reason ?? null}
          />
        </div>
      ) : null}

      {isAdmin && (
        <BillingSection
          subscription={subscription}
          teamMemberCount={teamMemberCount}
          prices={{ starterPriceId, growthPriceId }}
          billingResult={params.billing ?? null}
        />
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">Organization</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Manage your org profile, name, and preferences.
        </p>
        <div className="mt-4 inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
          Coming soon
        </div>
      </div>
    </div>
  );
}
