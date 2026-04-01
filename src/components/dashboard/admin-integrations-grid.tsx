import { SlackIntegrationPanel } from "@/components/dashboard/slack-integration-panel";
import { TeamsIntegrationPanel } from "@/components/dashboard/teams-integration-panel";
import type { AdminIntegrationsLoad } from "@/lib/dashboard/load-admin-integrations";

type Props = {
  data: AdminIntegrationsLoad;
  slackResult: string | null;
  slackReason: string | null;
  teamsResult?: string | null;
  teamsReason?: string | null;
};

/** Slack + Teams cards for admin Integrations hub (Settings and /dashboard/integrations). */
export function AdminIntegrationsGrid({
  data,
  slackResult,
  slackReason,
  teamsResult = null,
  teamsReason = null,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SlackIntegrationPanel
        connected={data.slackConnected}
        teamId={data.slackTeamId}
        mappedUsers={data.mappedUsers}
        slackResult={slackResult}
        slackReason={slackReason}
        initialAdminChannelId={data.slackAdminChannelId}
        slackEventsUrl={data.slackEventsUrl}
        slackOAuthRedirectUrl={data.slackOAuthRedirectUrl}
        publicAppOrigin={data.publicAppOrigin}
      />
      <TeamsIntegrationPanel
        connected={data.teamsConnected}
        tenantId={data.teamsTenantId}
        mappedUsers={data.teamsMappedUsers}
        teamsResult={teamsResult}
        teamsReason={teamsReason}
        teamsOAuthUrl={data.teamsOAuthUrl}
        publicAppOrigin={data.publicAppOrigin}
        teamsEnvConfigured={data.teamsEnvConfigured}
      />
    </div>
  );
}
