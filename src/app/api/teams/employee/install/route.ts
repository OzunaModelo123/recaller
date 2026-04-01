/**
 * Starts delegated OAuth so the signed-in user can link their Microsoft / Teams identity
 * to their Recaller profile (sets users.teams_user_id). Use when email-based sync missed them.
 */
import { NextResponse } from "next/server";

import { getPublicAppOrigin } from "@/lib/public-app-url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function redirectIntegrations(
  key: "error",
  reason: string,
  requestUrl?: string,
) {
  let base = getPublicAppOrigin();
  if (!base && requestUrl) {
    try {
      base = new URL(requestUrl).origin;
    } catch {
      base = "";
    }
  }
  const dest = new URL(
    "/employee/integrations",
    base || "http://localhost:3000",
  );
  dest.searchParams.set("teams", key);
  dest.searchParams.set("teams_reason", reason);
  return NextResponse.redirect(dest.toString());
}

export async function GET(request: Request) {
  const appId = process.env.TEAMS_APP_ID?.trim();
  const tenantId = process.env.TEAMS_TENANT_ID?.trim();
  const origin = getPublicAppOrigin();

  if (!origin) {
    return redirectIntegrations("error", "missing_app_url", request.url);
  }
  if (!appId || !tenantId) {
    return redirectIntegrations("error", "missing_teams_env", request.url);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", origin);
    login.searchParams.set("next", "/employee/integrations");
    return NextResponse.redirect(login.toString());
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return redirectIntegrations("error", "no_org", request.url);
  }

  const { data: org } = await supabase
    .from("organisations")
    .select("teams_tenant_id")
    .eq("id", profile.org_id)
    .maybeSingle();

  if (!org?.teams_tenant_id) {
    return redirectIntegrations("error", "workspace_teams_not_connected", request.url);
  }

  const state = Buffer.from(
    JSON.stringify({ uid: user.id, exp: Date.now() + 600_000 }),
  ).toString("base64url");

  const redirectUri = `${origin}/api/teams/employee/oauth`;

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set(
    "scope",
    "openid profile email offline_access User.Read",
  );
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_mode", "query");
  // Let users pick the right identity when they have both personal + work Microsoft accounts.
  authUrl.searchParams.set("prompt", "select_account");
  const domainHint = process.env.TEAMS_EMPLOYEE_LOGIN_DOMAIN_HINT?.trim();
  if (domainHint) {
    authUrl.searchParams.set("domain_hint", domainHint);
  }

  return NextResponse.redirect(authUrl.toString());
}
