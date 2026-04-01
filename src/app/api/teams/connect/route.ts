/**
 * POST /api/teams/connect
 *
 * Server-side Teams connection using client_credentials grant.
 * No interactive OAuth or redirect URI needed — the app authenticates
 * directly with Azure AD using its own credentials, then uses
 * Microsoft Graph (application permissions) to map tenant users.
 *
 * Requires TEAMS_APP_ID, TEAMS_APP_PASSWORD, TEAMS_TENANT_ID env vars.
 * The Azure App Registration needs the Graph application permission
 * User.Read.All (with admin consent granted).
 */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapTeamsUsersToRecaller } from "@/lib/teams/mapTeamsUsersToRecaller";

export const runtime = "nodejs";

export async function POST() {
  const tenantId = process.env.TEAMS_TENANT_ID?.trim();
  const appId = process.env.TEAMS_APP_ID?.trim();
  const appPassword = process.env.TEAMS_APP_PASSWORD?.trim();

  if (!tenantId || !appId || !appPassword) {
    return NextResponse.json(
      { error: "missing_teams_env", message: "TEAMS_APP_ID, TEAMS_APP_PASSWORD, and TEAMS_TENANT_ID must be set." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const orgId = profile.org_id;

  try {
    const graphToken = await getGraphTokenViaClientCredentials(tenantId, appId, appPassword);

    const sb = createAdminClient();

    const { data: orgRow } = await sb
      .from("organisations")
      .select("id, teams_tenant_id")
      .eq("id", orgId)
      .single();

    if (!orgRow) {
      return NextResponse.json({ error: "org_not_found" }, { status: 404 });
    }

    if (orgRow.teams_tenant_id && orgRow.teams_tenant_id !== tenantId) {
      return NextResponse.json(
        { error: "org_already_linked", message: "Organisation is already linked to a different tenant." },
        { status: 409 },
      );
    }

    const { data: tenantTaken } = await sb
      .from("organisations")
      .select("id")
      .eq("teams_tenant_id", tenantId)
      .neq("id", orgId)
      .maybeSingle();

    if (tenantTaken) {
      return NextResponse.json(
        { error: "tenant_already_linked", message: "This Teams tenant is already linked to another organisation." },
        { status: 409 },
      );
    }

    await sb
      .from("organisations")
      .update({ teams_tenant_id: tenantId })
      .eq("id", orgId);

    await sb.from("teams_installations").upsert(
      {
        org_id: orgId,
        tenant_id: tenantId,
        bot_id: appId,
        bot_password_encrypted: "",
        service_url: "https://smba.trafficmanager.net/teams/",
      },
      { onConflict: "org_id" },
    );

    const { mapped } = await mapTeamsUsersToRecaller(graphToken, orgId);

    return NextResponse.json({ ok: true, mappedUsers: mapped });
  } catch (err) {
    console.error("[Teams Connect]", err);

    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("invalid_client") || message.includes("AADSTS7000215")) {
      return NextResponse.json(
        {
          error: "invalid_client",
          message:
            "Azure rejected the app credentials. Check that TEAMS_APP_ID and TEAMS_APP_PASSWORD are correct " +
            "and the client secret has not expired. In Azure Portal → App registrations → your app → " +
            "Certificates & secrets, create a new secret if needed.",
        },
        { status: 401 },
      );
    }

    if (message.includes("Authorization_RequestDenied") || message.includes("Insufficient privileges")) {
      return NextResponse.json(
        {
          error: "missing_graph_permissions",
          message:
            "The app does not have permission to read users. In Azure Portal → App registrations → " +
            "your app → API permissions, add Microsoft Graph → Application permission → User.Read.All, " +
            "then click 'Grant admin consent'.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "connect_failed", message },
      { status: 500 },
    );
  }
}

async function getGraphTokenViaClientCredentials(
  tenantId: string,
  appId: string,
  appPassword: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appId,
    client_secret: appPassword,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[Teams Connect] client_credentials token failed:", text);
    throw new Error(`Token request failed: ${text}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

