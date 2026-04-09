import Link from "next/link";
import { redirect } from "next/navigation";
import { Plug } from "lucide-react";

import { PageHeader } from "@/components/design/page-header";
import { EMPTY_ORG_CONTEXT } from "@/lib/ai/orgContext";
import { CompanyContextSettingsPanel } from "@/components/dashboard/company-context-forms";
import { AdminIntegrationsGrid } from "@/components/dashboard/admin-integrations-grid";
import { BillingSection } from "@/components/dashboard/billing-section";
import { OrganizationSettingsSection } from "@/components/dashboard/organization-settings-section";
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
  let orgForSettings: {
    id: string;
    name: string;
    logo_url: string | null;
    industry: string | null;
    size: string | null;
  } | null = null;

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

    const { data: orgRow } = await supabase
      .from("organisations")
      .select("id, name, logo_url, industry, size")
      .eq("id", profile.org_id)
      .single();
    if (orgRow) {
      orgForSettings = orgRow;
    }
  }

  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID ?? "";
  const growthPriceId = process.env.STRIPE_GROWTH_PRICE_ID ?? "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Organization profile, AI context, integrations, and billing."
      />

      {isAdmin && (
        <div id="company-context" className="scroll-mt-24">
          <CompanyContextSettingsPanel initial={initial} />
        </div>
      )}

      {isAdmin && integrationsData ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Integrations</h2>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" asChild>
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

      {isAdmin && orgForSettings ? (
        <OrganizationSettingsSection
          orgId={orgForSettings.id}
          initialName={orgForSettings.name}
          initialLogoUrl={orgForSettings.logo_url}
          industry={orgForSettings.industry}
          size={orgForSettings.size}
        />
      ) : null}
    </div>
  );
}
