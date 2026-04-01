import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { AdminIntegrationsGrid } from "@/components/dashboard/admin-integrations-grid";
import { PageHeader } from "@/components/design/page-header";
import { Button } from "@/components/ui/button";
import { loadAdminIntegrationsForUser } from "@/lib/dashboard/load-admin-integrations";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    slack?: string;
    reason?: string;
  }>;
};

export default async function DashboardIntegrationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await loadAdminIntegrationsForUser(supabase, user.id);
  if (!data) redirect("/employee");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Integrations"
          subtitle="Connect Slack and Microsoft Teams for your workspace. Employees link their own accounts from Employee → Integrations."
        />
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            Company &amp; AI settings
          </Link>
        </Button>
      </div>

      <AdminIntegrationsGrid
        data={data}
        slackResult={params.slack ?? null}
        slackReason={params.reason ?? null}
      />
    </div>
  );
}
