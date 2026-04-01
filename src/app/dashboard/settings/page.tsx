import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Building2, Plug } from "lucide-react";

import { EMPTY_ORG_CONTEXT } from "@/lib/ai/orgContext";
import { CompanyContextSettingsPanel } from "@/components/dashboard/company-context-forms";
import { AdminIntegrationsGrid } from "@/components/dashboard/admin-integrations-grid";
import { Button } from "@/components/ui/button";
import { loadAdminIntegrationsForUser } from "@/lib/dashboard/load-admin-integrations";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ slack?: string; reason?: string }>;
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          {
            icon: Building2,
            label: "Organization",
            desc: "Manage your org profile, name, and preferences.",
            color: "text-primary",
            bg: "bg-secondary border border-border",
          },
          {
            icon: CreditCard,
            label: "Billing",
            desc: "Manage your subscription, seats, and invoices.",
            color: "text-primary",
            bg: "bg-secondary border border-border",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">{item.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.desc}
            </p>
            <div className="mt-4 inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              Coming soon
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
