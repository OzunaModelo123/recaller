/**
 * Teams / Azure AD OAuth callback for workspace-level connection.
 * Admin initiates from Dashboard → Integrations → Connect Teams.
 * This exchanges the authorization code for tokens, stores the tenant info,
 * and maps Teams users to Recaller users by email via Microsoft Graph.
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function redirect(key: "success" | "error", reason?: string) {
  const dest = new URL(
    "/dashboard/integrations",
    process.env.NEXT_PUBLIC_APP_URL!,
  );
  dest.searchParams.set("teams", key);
  if (reason) dest.searchParams.set("reason", reason);
  return NextResponse.redirect(dest.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  if (error || !code) {
    return redirect("error", error ?? "missing_code");
  }

  if (!stateParam) {
    return redirect("error", "missing_state");
  }

  let state: { orgId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as { orgId: string };
  } catch {
    return redirect("error", "invalid_state");
  }

  const orgId = state.orgId;
  if (!orgId) return redirect("error", "missing_org_id");

  const tenantId = process.env.TEAMS_TENANT_ID;
  const appId = process.env.TEAMS_APP_ID;
  const appPassword = process.env.TEAMS_APP_PASSWORD;

  if (!tenantId || !appId || !appPassword) {
    return redirect("error", "missing_teams_env");
  }

  try {
    const tokenBody = new URLSearchParams({
      client_id: appId,
      client_secret: appPassword,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/teams/oauth`,
      scope: "https://graph.microsoft.com/.default",
    });

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      },
    );

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("[Teams OAuth] token exchange failed", text);
      throw new Error("token_exchange_failed");
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    const sb = createAdminClient();

    const { data: orgRow } = await sb
      .from("organisations")
      .select("id, teams_tenant_id")
      .eq("id", orgId)
      .single();

    if (!orgRow) throw new Error("org_not_found");

    if (orgRow.teams_tenant_id && orgRow.teams_tenant_id !== tenantId) {
      throw new Error("org_already_linked_other_tenant");
    }

    const { data: tenantTaken } = await sb
      .from("organisations")
      .select("id")
      .eq("teams_tenant_id", tenantId)
      .neq("id", orgId)
      .maybeSingle();

    if (tenantTaken) throw new Error("tenant_already_linked");

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

    await mapTeamsUsersToRecaller(tokenData.access_token, orgId);

    return redirect("success");
  } catch (err) {
    console.error("[Teams OAuth]", err);
    return redirect(
      "error",
      err instanceof Error ? err.message : "unknown",
    );
  }
}

async function mapTeamsUsersToRecaller(
  graphToken: string,
  orgId: string,
) {
  const sb = createAdminClient();

  let nextLink: string | null =
    "https://graph.microsoft.com/v1.0/users?$select=id,mail,userPrincipalName&$top=100";

  while (nextLink) {
    const res = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${graphToken}` },
    });

    if (!res.ok) {
      console.error("[Teams OAuth] Graph users.list failed", await res.text());
      break;
    }

    const data = (await res.json()) as {
      value: { id: string; mail?: string; userPrincipalName?: string }[];
      "@odata.nextLink"?: string;
    };

    for (const member of data.value) {
      const email = (member.mail ?? member.userPrincipalName ?? "").toLowerCase().trim();
      if (!email) continue;

      await sb
        .from("users")
        .update({ teams_user_id: member.id })
        .eq("org_id", orgId)
        .ilike("email", email);
    }

    nextLink = data["@odata.nextLink"] ?? null;
  }
}
