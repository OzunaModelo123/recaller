import { createAdminClient } from "@/lib/supabase/admin";
import { TeamsNotifier } from "./TeamsNotifier";

export type TeamsAssignmentPushResult =
  | { ok: true; activityId: string }
  | {
      ok: false;
      reason: "no_installation" | "no_teams_user" | "send_failed";
      detail?: string;
    };

/**
 * After an assignment row exists, DM the assignee with an Adaptive Card (if they linked Teams).
 * Skips quietly when org has no Teams install or employee has no teams_user_id.
 */
export async function notifyTeamsAssignmentOnCreate(params: {
  orgId: string;
  assignmentId: string;
  assigneeUserId: string;
}): Promise<TeamsAssignmentPushResult> {
  const sb = createAdminClient();

  const { data: inst } = await sb
    .from("teams_installations")
    .select("service_url, tenant_id")
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!inst?.service_url || !inst.tenant_id) {
    return { ok: false, reason: "no_installation" };
  }

  const { data: assignee } = await sb
    .from("users")
    .select("teams_user_id")
    .eq("id", params.assigneeUserId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!assignee?.teams_user_id) {
    return { ok: false, reason: "no_teams_user" };
  }

  try {
    const notifier = new TeamsNotifier();
    const activityId = await notifier.sendAssignment(assignee.teams_user_id, {
      assignmentId: params.assignmentId,
      orgId: params.orgId,
      userId: params.assigneeUserId,
    });
    return { ok: true, activityId };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[notifyTeamsAssignmentOnCreate]", detail);
    return { ok: false, reason: "send_failed", detail };
  }
}
