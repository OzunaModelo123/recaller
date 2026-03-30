import { createAdminClient } from "@/lib/supabase/admin";
import { openSlackBotToken } from "@/lib/slack/bot-token-crypto";

import { SlackNotifier } from "./SlackNotifier";

/**
 * After an assignment row exists, DM the assignee with Block Kit (if they linked Slack).
 * No-op if workspace has no bot install or employee has not completed Link Slack.
 */
export async function notifySlackAssignmentOnCreate(params: {
  orgId: string;
  assignmentId: string;
  assigneeUserId: string;
}): Promise<void> {
  const sb = createAdminClient();
  const { data: inst } = await sb
    .from("slack_installations")
    .select("bot_token_encrypted")
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!inst?.bot_token_encrypted) return;

  let token: string;
  try {
    token = openSlackBotToken(inst.bot_token_encrypted);
  } catch {
    return;
  }

  const { data: assignee } = await sb
    .from("users")
    .select("slack_user_id, slack_employee_linked_at")
    .eq("id", params.assigneeUserId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (
    !assignee?.slack_user_id ||
    assignee.slack_employee_linked_at == null
  ) {
    return;
  }

  const notifier = new SlackNotifier(token);
  await notifier.sendAssignment(assignee.slack_user_id, {
    assignmentId: params.assignmentId,
    orgId: params.orgId,
    userId: params.assigneeUserId,
  });
}
