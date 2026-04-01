/**
 * Redirects admin to Microsoft identity platform consent flow.
 * After consent, Microsoft redirects back to /api/teams/oauth.
 */
import { NextResponse } from "next/server";

import { getPublicAppOrigin } from "@/lib/public-app-url";
import { createClient } from "@/lib/supabase/server";
import { signTeamsAdminInstallState } from "@/lib/teams/oauth-state";

export const runtime = "nodejs";

function redirectToIntegrations(reason: string, requestUrl?: string) {
  let base = getPublicAppOrigin();
  if (!base && requestUrl) {
    try {
      base = new URL(requestUrl).origin;
    } catch {
      base = "";
    }
  }
  const dest = new URL(
    "/dashboard/integrations",
    base || "http://localhost:3000",
  );
  dest.searchParams.set("teams", "error");
  dest.searchParams.set("reason", reason);
  return NextResponse.redirect(dest.toString());
}

export async function GET(request: Request) {
  const appId = process.env.TEAMS_APP_ID?.trim();
  const tenantId = process.env.TEAMS_TENANT_ID?.trim();
  const origin = getPublicAppOrigin();

  if (!origin) {
    return redirectToIntegrations("missing_app_url", request.url);
  }

  if (!appId || !tenantId) {
    return redirectToIntegrations("missing_teams_env", request.url);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (
    !profile?.org_id ||
    !["admin", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.redirect(`${origin}/dashboard/integrations?teams=error&reason=forbidden`);
  }

  const state = signTeamsAdminInstallState(profile.org_id, user.id);

  const redirectUri = `${origin}/api/teams/oauth`;

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "https://graph.microsoft.com/.default");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_mode", "query");

  return NextResponse.redirect(authUrl.toString());
}
