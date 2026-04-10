import { redirect } from "next/navigation";

import { PageHeader } from "@/components/design/page-header";
import { EmployeeSlackIntegrationCard } from "@/components/employee/employee-slack-integration-card";
import { EmployeeTeamsIntegrationCard } from "@/components/employee/employee-teams-integration-card";
import { getEmployeeSessionProfile } from "@/lib/employee/session-profile";
import { getPublicAppOrigin } from "@/lib/public-app-url";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    slack?: string;
    reason?: string;
    teams?: string;
    teams_reason?: string;
  }>;
};

export default async function EmployeeIntegrationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getEmployeeSessionProfile(user.id, user.email);
  if (!profile) redirect("/post-login");

  const { data: row } = await supabase
    .from("users")
    .select("slack_employee_linked_at, teams_user_id, organisations ( slack_team_id, teams_tenant_id )")
    .eq("id", user.id)
    .maybeSingle();

  const orgSlack =
    row?.organisations &&
    typeof row.organisations === "object" &&
    "slack_team_id" in row.organisations
      ? (row.organisations as { slack_team_id: string | null }).slack_team_id
      : null;

  const orgTeams =
    row?.organisations &&
    typeof row.organisations === "object" &&
    "teams_tenant_id" in row.organisations
      ? (row.organisations as { teams_tenant_id: string | null }).teams_tenant_id
      : null;

  const workspaceSlackConnected = !!orgSlack;
  const employeeSlackLinked = row?.slack_employee_linked_at != null;
  const workspaceTeamsConnected = !!orgTeams;
  const employeeTeamsLinked = !!row?.teams_user_id;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        subtitle={`${profile.orgName} · Link Slack or Teams to get training plans in direct messages and complete steps there.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EmployeeSlackIntegrationCard
          slackResult={params.slack ?? null}
          slackReason={params.reason ?? null}
          workspaceSlackConnected={workspaceSlackConnected}
          employeeSlackLinked={employeeSlackLinked}
        />
        <EmployeeTeamsIntegrationCard
          workspaceTeamsConnected={workspaceTeamsConnected}
          employeeTeamsLinked={employeeTeamsLinked}
          teamsResult={params.teams ?? null}
          teamsReason={params.teams_reason ?? null}
          publicAppOrigin={getPublicAppOrigin()}
        />
      </div>
    </div>
  );
}
