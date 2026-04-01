/**
 * OAuth callback for employee Teams self-link. Exchanges code, reads AAD object id from Graph /me,
 * verifies tenant id from id_token matches org, then sets users.teams_user_id.
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicAppOrigin } from "@/lib/public-app-url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function redirectIntegrations(
  key: "success" | "error",
  reason?: string,
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
  if (reason) dest.searchParams.set("teams_reason", reason);
  return NextResponse.redirect(dest.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  if (err || !code) {
    return redirectIntegrations("error", err ?? "missing_code", request.url);
  }

  let state: { uid: string; exp: number };
  try {
    state = JSON.parse(
      Buffer.from(stateParam ?? "", "base64url").toString("utf8"),
    ) as { uid: string; exp: number };
  } catch {
    return redirectIntegrations("error", "invalid_state", request.url);
  }

  if (!state.uid || typeof state.exp !== "number") {
    return redirectIntegrations("error", "invalid_state", request.url);
  }
  if (Date.now() > state.exp) {
    return redirectIntegrations("error", "state_expired", request.url);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.uid) {
    return redirectIntegrations("error", "session_mismatch", request.url);
  }

  const tenantId = process.env.TEAMS_TENANT_ID?.trim();
  const appId = process.env.TEAMS_APP_ID?.trim();
  const appPassword = process.env.TEAMS_APP_PASSWORD?.trim();

  if (!tenantId || !appId || !appPassword) {
    return redirectIntegrations("error", "missing_teams_env", request.url);
  }

  let base = getPublicAppOrigin();
  if (!base) {
    try {
      base = new URL(request.url).origin;
    } catch {
      return redirectIntegrations("error", "missing_app_url", request.url);
    }
  }
  const redirectUri = `${base}/api/teams/employee/oauth`;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appPassword,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    },
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[Teams employee OAuth] token exchange failed", text);
    return redirectIntegrations("error", "token_exchange_failed", request.url);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
  };

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return redirectIntegrations("error", "no_org", request.url);
  }

  const sb = createAdminClient();
  const { data: orgRow } = await sb
    .from("organisations")
    .select("teams_tenant_id")
    .eq("id", profile.org_id)
    .maybeSingle();

  const expectedTid = orgRow?.teams_tenant_id?.toLowerCase();
  if (!expectedTid) {
    return redirectIntegrations("error", "workspace_teams_not_connected", request.url);
  }

  if (tokenData.id_token) {
    const claims = decodeJwtPayload(tokenData.id_token);
    const tid = (claims?.tid as string | undefined)?.toLowerCase();
    if (tid && tid !== expectedTid) {
      return redirectIntegrations("error", "wrong_tenant", request.url);
    }
  }

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    console.error("[Teams employee OAuth] Graph /me failed", await meRes.text());
    return redirectIntegrations("error", "graph_me_failed", request.url);
  }

  const me = (await meRes.json()) as { id?: string };
  if (!me.id) {
    return redirectIntegrations("error", "no_aad_id", request.url);
  }

  const { error: upErr } = await sb
    .from("users")
    .update({ teams_user_id: me.id })
    .eq("id", user.id)
    .eq("org_id", profile.org_id);

  if (upErr) {
    console.error("[Teams employee OAuth] DB update failed", upErr);
    return redirectIntegrations("error", "update_failed", request.url);
  }

  return redirectIntegrations("success", undefined, request.url);
}
