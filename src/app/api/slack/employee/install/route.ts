import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openSlackBotToken } from "@/lib/slack/bot-token-crypto";

export const runtime = "nodejs";

/**
 * Employee Slack self-link: uses the **existing** bot token from the admin workspace install
 * to look up the employee by email in the Slack workspace and link their slack_user_id.
 *
 * No OAuth redirect needed — avoids `invalid_team_for_non_distributed_app` entirely.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const dest = new URL("/login", process.env.NEXT_PUBLIC_APP_URL!);
    dest.searchParams.set("next", "/employee/my-plans");
    return NextResponse.redirect(dest.toString());
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role, email")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return fail("no_org");
  }

  if (["admin", "super_admin"].includes(profile.role)) {
    return fail("employee_flow_only");
  }

  const sb = createAdminClient();

  const { data: org } = await sb
    .from("organisations")
    .select("slack_team_id")
    .eq("id", profile.org_id)
    .maybeSingle();

  if (!org?.slack_team_id) {
    return fail("workspace_not_installed");
  }

  const { data: inst } = await sb
    .from("slack_installations")
    .select("bot_token_encrypted")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (!inst?.bot_token_encrypted) {
    return fail("no_bot_token");
  }

  let botToken: string;
  try {
    botToken = openSlackBotToken(inst.bot_token_encrypted);
  } catch {
    return fail("token_decrypt");
  }

  const client = new WebClient(botToken);
  const email = (profile.email ?? user.email ?? "").toLowerCase().trim();
  if (!email) {
    return fail("no_email");
  }

  let slackUserId: string | null = null;
  try {
    const resp = await client.users.lookupByEmail({ email });
    slackUserId = resp.user?.id ?? null;
  } catch (e: unknown) {
    const errStr = String((e as { data?: { error?: string } })?.data?.error ?? e);
    if (errStr.includes("users_not_found")) {
      return fail("slack_email_not_found");
    }
    console.error("[Slack employee link] lookupByEmail failed:", errStr);
    return fail("slack_lookup_failed");
  }

  if (!slackUserId) {
    return fail("slack_email_not_found");
  }

  await sb
    .from("users")
    .update({
      slack_user_id: slackUserId,
      slack_employee_linked_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("org_id", profile.org_id);

  const dest = new URL("/employee/my-plans", process.env.NEXT_PUBLIC_APP_URL!);
  dest.searchParams.set("slack", "success");
  return NextResponse.redirect(dest.toString());
}

function fail(reason: string) {
  const dest = new URL("/employee/my-plans", process.env.NEXT_PUBLIC_APP_URL!);
  dest.searchParams.set("slack", "error");
  dest.searchParams.set("reason", reason);
  return NextResponse.redirect(dest.toString());
}
