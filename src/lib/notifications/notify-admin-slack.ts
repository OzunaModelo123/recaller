import { WebClient } from "@slack/web-api";

import { createAdminClient } from "@/lib/supabase/admin";
import { openSlackBotToken } from "@/lib/slack/bot-token-crypto";
import { buildAdminCompletionNotice } from "@/lib/slack/blockKit";

export type NotifyCompletionParams = {
  orgId: string;
  assignmentId: string;
  stepNumber: number;
  platform: "slack" | "web" | "teams";
};

/**
 * Posts a read-only summary to the org's configured admin Slack channel when a step is completed.
 */
export async function notifyAdminSlackChannelOnCompletion(
  params: NotifyCompletionParams,
): Promise<void> {
  const sb = createAdminClient();

  const { data: org } = await sb
    .from("organisations")
    .select("slack_admin_channel_id")
    .eq("id", params.orgId)
    .maybeSingle();

  const channelId = org?.slack_admin_channel_id?.trim();
  if (!channelId) return;

  const { data: inst } = await sb
    .from("slack_installations")
    .select("bot_token_encrypted")
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!inst?.bot_token_encrypted) return;

  let token: string;
  try {
    token = openSlackBotToken(inst.bot_token_encrypted);
  } catch (e) {
    console.error("[Slack] admin notify: token decrypt failed", e);
    return;
  }

  const { data: assignment } = await sb
    .from("assignments")
    .select("id, assigned_to, plan_id, plans(title)")
    .eq("id", params.assignmentId)
    .maybeSingle();

  if (!assignment || assignment.id !== params.assignmentId) return;

  const { data: assignee } = await sb
    .from("users")
    .select("full_name, email")
    .eq("id", assignment.assigned_to)
    .maybeSingle();

  const planTitle =
    (assignment as unknown as { plans: { title: string } | null }).plans?.title ??
    "Training Plan";

  const employeeName =
    assignee?.full_name?.trim() || assignee?.email?.split("@")[0] || "Team member";

  const { count: totalSteps, error: tsErr } = await sb
    .from("plan_steps")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", assignment.plan_id);

  const { count: doneCount, error: dcErr } = await sb
    .from("step_completions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", params.assignmentId);

  if (tsErr || dcErr || totalSteps == null || totalSteps < 1 || doneCount == null) return;

  const percentRounded =
    totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  const blocks = buildAdminCompletionNotice({
    employeeName,
    planTitle,
    stepNumber: params.stepNumber,
    totalSteps,
    percentRounded,
    platform: params.platform,
  });

  const client = new WebClient(token);
  try {
    await client.chat.postMessage({
      channel: channelId,
      blocks,
      text: `${employeeName} completed a training step on ${planTitle}`,
    });
  } catch (e) {
    console.error("[Slack] admin channel post failed", e);
  }
}
