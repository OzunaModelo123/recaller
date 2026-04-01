import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sealSlackBotToken } from "@/lib/slack/bot-token-crypto";
import { verifySlackOAuthState } from "@/lib/slack/oauth-state";

export const runtime = "nodejs";

function redirect(key: "success" | "error", reason?: string) {
  const dest = new URL(
    "/dashboard/settings",
    process.env.NEXT_PUBLIC_APP_URL!,
  );
  dest.searchParams.set("slack", key);
  if (reason) dest.searchParams.set("reason", reason);
  return NextResponse.redirect(dest.toString());
}

/**
 * Admin-only OAuth callback. Employee linking no longer uses OAuth —
 * it uses the bot token + email lookup instead (see /api/slack/employee/install).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  if (error || !code) {
    return redirect("error", error ?? "missing_code");
  }

  const state = verifySlackOAuthState(stateParam);
  if (!state) {
    return redirect("error", "invalid_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) {
    return redirect("error", "session_mismatch");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (
    !profile?.org_id ||
    profile.org_id !== state.orgId ||
    !["admin", "super_admin"].includes(profile.role ?? "")
  ) {
    return redirect("error", "forbidden");
  }

  const orgId = state.orgId;

  try {
    const oauthResponse = await new WebClient().oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/oauth`,
    });

    if (!oauthResponse.ok || !oauthResponse.access_token || !oauthResponse.team?.id) {
      throw new Error(oauthResponse.error ?? "oauth_exchange_failed");
    }

    const botToken = oauthResponse.access_token;
    const teamId = oauthResponse.team.id;
    const botUserId = oauthResponse.bot_user_id ?? null;
    const tokenScopes = (oauthResponse.scope ?? "").split(",");

    const sb = createAdminClient();

    const { data: orgRow } = await sb
      .from("organisations")
      .select("id, slack_team_id")
      .eq("id", orgId)
      .single();

    if (!orgRow) {
      throw new Error("org_not_found");
    }

    if (
      orgRow.slack_team_id &&
      orgRow.slack_team_id !== teamId
    ) {
      throw new Error("org_already_linked_other_workspace");
    }

    const { data: teamTaken } = await sb
      .from("organisations")
      .select("id")
      .eq("slack_team_id", teamId)
      .neq("id", orgId)
      .maybeSingle();

    if (teamTaken) {
      throw new Error("workspace_already_linked");
    }

    await sb
      .from("organisations")
      .update({ slack_team_id: teamId })
      .eq("id", orgId);

    await sb.from("slack_installations").upsert(
      {
        org_id: orgId,
        team_id: teamId,
        bot_token_encrypted: sealSlackBotToken(botToken),
        bot_user_id: botUserId,
        scopes: tokenScopes,
        installation_kind: "workspace",
      },
      { onConflict: "org_id" },
    );

    await mapSlackUsersToRecaller(botToken, orgId);

    return redirect("success");
  } catch (err) {
    console.error("[Slack OAuth]", err);
    return redirect(
      "error",
      err instanceof Error ? err.message : "unknown",
    );
  }
}

async function mapSlackUsersToRecaller(botToken: string, orgId: string) {
  const client = new WebClient(botToken);
  const sb = createAdminClient();

  let cursor: string | undefined;
  do {
    const resp = await client.users.list({ cursor, limit: 200 });
    const members = resp.members ?? [];

    for (const member of members) {
      if (member.is_bot || member.deleted || !member.profile?.email) continue;

      const email = member.profile.email.toLowerCase();
      await sb
        .from("users")
        .update({ slack_user_id: member.id! })
        .eq("org_id", orgId)
        .ilike("email", email);
    }

    cursor = resp.response_metadata?.next_cursor || undefined;
  } while (cursor);
}
