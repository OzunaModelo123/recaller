import { SlackIntegrationPanel } from "@/components/dashboard/slack-integration-panel";
import { TeamsIntegrationPlaceholder } from "@/components/dashboard/teams-integration-placeholder";
import type { AdminIntegrationsLoad } from "@/lib/dashboard/load-admin-integrations";

type Props = {
  data: AdminIntegrationsLoad;
  slackResult: string | null;
  slackReason: string | null;
};

/** Slack + Teams cards for admin Integrations hub (Settings and /dashboard/integrations). */
export function AdminIntegrationsGrid({ data, slackResult, slackReason }: Props) {
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
      <TeamsIntegrationPlaceholder variant="admin" />
    </div>
  );
}
