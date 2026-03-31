import { redirect } from "next/navigation";

import { PageHeader } from "@/components/design/page-header";
import { EmployeeSlackIntegrationCard } from "@/components/employee/employee-slack-integration-card";
import { TeamsIntegrationPlaceholder } from "@/components/dashboard/teams-integration-placeholder";
import { getEmployeeSessionProfile } from "@/lib/employee/session-profile";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ slack?: string; reason?: string }> };

export default async function EmployeeIntegrationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const profile = await getEmployeeSessionProfile(user.id, user.email);
  if (!profile) redirect("/post-login");

  const { data: row } = await supabase
    .from("users")
    .select("slack_employee_linked_at, organisations ( slack_team_id )")
    .eq("id", user.id)
    .maybeSingle();

  const orgSlack =
    row?.organisations &&
    typeof row.organisations === "object" &&
    "slack_team_id" in row.organisations
      ? (row.organisations as { slack_team_id: string | null }).slack_team_id
      : null;

  const workspaceSlackConnected = !!orgSlack;
  const employeeSlackLinked = row?.slack_employee_linked_at != null;

  return (
    <div className="space-y-8">
      <div className="space-y-4 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {profile.orgName}
        </p>
        <PageHeader
          title="Integrations"
          subtitle="Link Slack to get training plans in direct messages and complete steps there. This page matches what admins set up under Dashboard → Integrations."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <EmployeeSlackIntegrationCard
            slackResult={params.slack ?? null}
            slackReason={params.reason ?? null}
            workspaceSlackConnected={workspaceSlackConnected}
            employeeSlackLinked={employeeSlackLinked}
          />
        </div>
        <TeamsIntegrationPlaceholder variant="employee" />
      </div>
    </div>
  );
}
