import { redirect } from "next/navigation";
import { Blocks, CreditCard, Building2 } from "lucide-react";

import { parseOrgContext } from "@/lib/ai/orgContext";
import { CompanyContextSettingsPanel } from "@/components/dashboard/company-context-forms";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
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
          .select("org_context")
          .eq("id", profile.org_id)
          .maybeSingle()
      : { data: null };

  const initial = parseOrgContext(org?.org_context);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            icon: Building2,
            label: "Organization",
            desc: "Manage your org profile, name, and preferences.",
            color: "text-primary",
            bg: "bg-secondary border border-border",
          },
          {
            icon: Blocks,
            label: "Integrations",
            desc: "Connect Slack, Microsoft Teams, and other tools.",
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
