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
      <PageHeader
        title="Integrations"
        subtitle="Connect Slack and Microsoft Teams for your workspace. Employees link their own accounts from Employee → Integrations."
        action={
          <Button variant="outline" size="sm" asChild className="h-9 shrink-0 rounded-xl">
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Company &amp; AI settings
            </Link>
          </Button>
        }
      />

      <AdminIntegrationsGrid
        data={data}
        slackResult={params.slack ?? null}
        slackReason={params.reason ?? null}
      />
    </div>
  );
}
