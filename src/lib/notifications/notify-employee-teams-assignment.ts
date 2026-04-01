import { createAdminClient } from "@/lib/supabase/admin";
import { TeamsNotifier } from "./TeamsNotifier";

/**
 * After an assignment row exists, DM the assignee with an Adaptive Card (if they linked Teams).
 * No-op if org has no Teams install or employee has no teams_user_id.
 */
export async function notifyTeamsAssignmentOnCreate(params: {
  orgId: string;
  assignmentId: string;
  assigneeUserId: string;
}): Promise<void> {
  const sb = createAdminClient();

  const { data: inst } = await sb
    .from("teams_installations")
    .select("service_url, tenant_id")
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!inst?.service_url || !inst.tenant_id) return;

  const { data: assignee } = await sb
    .from("users")
    .select("teams_user_id")
    .eq("id", params.assigneeUserId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!assignee?.teams_user_id) return;

  const notifier = new TeamsNotifier();
  await notifier.sendAssignment(assignee.teams_user_id, {
    assignmentId: params.assignmentId,
    orgId: params.orgId,
    userId: params.assigneeUserId,
  });
}
