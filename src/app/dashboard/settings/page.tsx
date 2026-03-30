import { redirect } from "next/navigation";
import { CreditCard, Building2 } from "lucide-react";

import { parseOrgContext } from "@/lib/ai/orgContext";
import { CompanyContextSettingsPanel } from "@/components/dashboard/company-context-forms";
import { SlackIntegrationPanel } from "@/components/dashboard/slack-integration-panel";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ slack?: string; reason?: string }> };

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

  const { data: org } =
    profile?.org_id && isAdmin
      ? await supabase
          .from("organisations")
          .select("org_context, slack_team_id, slack_admin_channel_id")
          .eq("id", profile.org_id)
          .maybeSingle()
      : { data: null };

  const initial = parseOrgContext(org?.org_context);

  const slackConnected = !!org?.slack_team_id;
  let mappedUsers = 0;
  if (slackConnected && profile?.org_id) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .not("slack_user_id", "is", null);
    mappedUsers = count ?? 0;
  }

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

      {isAdmin && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Integrations</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SlackIntegrationPanel
              connected={slackConnected}
              teamId={org?.slack_team_id ?? null}
              mappedUsers={mappedUsers}
              slackResult={params.slack ?? null}
              slackReason={params.reason ?? null}
              initialAdminChannelId={org?.slack_admin_channel_id ?? null}
            />
          </div>
        </div>
      )}

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
