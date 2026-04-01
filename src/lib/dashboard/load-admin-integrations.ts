import { type OrgContext, parseOrgContext } from "@/lib/ai/orgContext";
import {
  getPublicAppOrigin,
  slackEventsRequestUrl,
  slackOAuthRedirectUrl,
  teamsOAuthStartUrl,
} from "@/lib/public-app-url";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminIntegrationsLoad = {
  isAdmin: boolean;
  initialOrgContext: OrgContext;
  slackConnected: boolean;
  slackTeamId: string | null;
  mappedUsers: number;
  slackEventsUrl: string;
  slackOAuthRedirectUrl: string;
  publicAppOrigin: string;
  slackAdminChannelId: string | null;
  teamsConnected: boolean;
  teamsTenantId: string | null;
  teamsMappedUsers: number;
  teamsOAuthUrl: string;
  /** True when TEAMS_APP_ID + TEAMS_TENANT_ID are set (required before Connect Teams works). */
  teamsEnvConfigured: boolean;
};

export async function loadAdminIntegrationsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminIntegrationsLoad | null> {
  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.org_id) return null;

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";
  if (!isAdmin) return null;

  const { data: org } = await supabase
    .from("organisations")
    .select("org_context, slack_team_id, slack_admin_channel_id, teams_tenant_id")
    .eq("id", profile.org_id)
    .maybeSingle();

  const slackConnected = !!org?.slack_team_id;
  let mappedUsers = 0;
  if (slackConnected) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .not("slack_user_id", "is", null);
    mappedUsers = count ?? 0;
  }

  const teamsConnected = !!org?.teams_tenant_id;
  let teamsMappedUsers = 0;
  if (teamsConnected) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .not("teams_user_id", "is", null);
    teamsMappedUsers = count ?? 0;
  }

  return {
    isAdmin: true,
    initialOrgContext: parseOrgContext(org?.org_context),
    slackConnected,
    slackTeamId: org?.slack_team_id ?? null,
    mappedUsers,
    slackEventsUrl: slackEventsRequestUrl(),
    slackOAuthRedirectUrl: slackOAuthRedirectUrl(),
    publicAppOrigin: getPublicAppOrigin(),
    slackAdminChannelId: org?.slack_admin_channel_id ?? null,
    teamsConnected,
    teamsTenantId: org?.teams_tenant_id ?? null,
    teamsMappedUsers,
    teamsOAuthUrl: teamsOAuthStartUrl(),
    teamsEnvConfigured: Boolean(
      process.env.TEAMS_APP_ID?.trim() && process.env.TEAMS_TENANT_ID?.trim(),
    ),
  };
}
