import { WebClient } from "@slack/web-api";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAssignmentMessage,
  buildNudgeMessage,
  buildWeeklyDigestMessage,
  type StepData,
  type AssignmentData,
  type DigestPayload,
} from "@/lib/slack/blockKit";

export class SlackNotifier {
  private client: WebClient;

  constructor(botToken: string) {
    this.client = new WebClient(botToken);
  }

  async sendAssignment(
    slackUserId: string,
    notification: {
      assignmentId: string;
      orgId: string;
      userId: string;
    },
  ) {
    const sb = createAdminClient();

    const { data: assignee } = await sb
      .from("users")
      .select("slack_user_id, slack_employee_linked_at")
      .eq("id", notification.userId)
      .maybeSingle();

    if (
      !assignee?.slack_user_id ||
      assignee.slack_employee_linked_at == null
    ) {
      return;
    }

    const { data: assignment } = await sb
      .from("assignments")
      .select(
        "id, plan_id, due_date, assigner_note, assigned_to, org_id, plans(title)",
      )
      .eq("id", notification.assignmentId)
      .single();
    if (!assignment || assignment.org_id !== notification.orgId) return;

    const { data: steps } = await sb
      .from("plan_steps")
      .select(
        "step_number, title, instructions, success_criteria, proof_type, proof_instructions, estimated_minutes",
      )
      .eq("plan_id", assignment.plan_id)
      .order("step_number", { ascending: true });

    const { data: completions } = await sb
      .from("step_completions")
      .select("step_number")
      .eq("assignment_id", assignment.id);

    const { data: userRow } = await sb
      .from("users")
      .select("full_name, email")
      .eq("id", assignment.assigned_to)
      .single();

    const planTitle =
      (assignment as unknown as { plans: { title: string } | null }).plans
        ?.title ?? "Training Plan";

    const assignmentData: AssignmentData = {
      id: assignment.id,
      planTitle,
      dueDate: assignment.due_date,
      assignerNote: assignment.assigner_note,
    };
    const completedSet = new Set(
      (completions ?? []).map((c) => c.step_number),
    );
    const employeeName =
      userRow?.full_name ?? userRow?.email ?? "there";

    const blocks = buildAssignmentMessage(
      assignmentData,
      (steps ?? []) as StepData[],
      employeeName,
      completedSet,
    );

    const result = await this.client.chat.postMessage({
      channel: slackUserId,
      blocks,
      text: `New training plan: ${planTitle}`,
    });

    if (result.ts) {
      await sb.from("notifications").insert({
        org_id: notification.orgId,
        user_id: notification.userId,
        type: "assignment",
        channel: "slack",
        payload: { assignmentId: assignment.id, planTitle },
        slack_message_ts: result.ts,
        sent_at: new Date().toISOString(),
      });
    }

    return result.ts;
  }

  async sendNudge(
    slackUserId: string,
    nudge: {
      assignmentId: string;
      currentStep: StepData;
      planTitle: string;
      orgId: string;
      userId: string;
    },
  ) {
    const sb = createAdminClient();
    const { data: assignee } = await sb
      .from("users")
      .select("slack_user_id, slack_employee_linked_at")
      .eq("id", nudge.userId)
      .maybeSingle();

    if (
      !assignee?.slack_user_id ||
      assignee.slack_employee_linked_at == null
    ) {
      return;
    }

    const assignmentData: AssignmentData = {
      id: nudge.assignmentId,
      planTitle: nudge.planTitle,
      dueDate: null,
      assignerNote: null,
    };

    const blocks = buildNudgeMessage(assignmentData, nudge.currentStep);

    await this.client.chat.postMessage({
      channel: slackUserId,
      blocks,
      text: `Reminder: ${nudge.planTitle} — Step ${nudge.currentStep.step_number}`,
    });
  }

  async sendStepConfirmation(
    slackUserId: string,
    assignmentId: string,
    _stepNumber: number,
  ) {
    const sb = createAdminClient();

    const { data: assignment } = await sb
      .from("assignments")
      .select(
        "id, plan_id, due_date, assigner_note, assigned_to, org_id, plans(title)",
      )
      .eq("id", assignmentId)
      .single();
    if (!assignment) return;

    const { data: notif } = await sb
      .from("notifications")
      .select("slack_message_ts")
      .eq("user_id", assignment.assigned_to)
      .eq("org_id", assignment.org_id)
      .eq("type", "assignment")
      .contains("payload", { assignmentId: assignment.id })
      .maybeSingle();

    if (!notif?.slack_message_ts) return;

    const { data: steps } = await sb
      .from("plan_steps")
      .select(
        "step_number, title, instructions, success_criteria, proof_type, proof_instructions, estimated_minutes",
      )
      .eq("plan_id", assignment.plan_id)
      .order("step_number", { ascending: true });

    const { data: completions } = await sb
      .from("step_completions")
      .select("step_number")
      .eq("assignment_id", assignmentId);

    const { data: userRow } = await sb
      .from("users")
      .select("full_name, email")
      .eq("id", assignment.assigned_to)
      .single();

    const planTitle =
      (assignment as unknown as { plans: { title: string } | null }).plans
        ?.title ?? "Training Plan";

    const assignmentData: AssignmentData = {
      id: assignment.id,
      planTitle,
      dueDate: assignment.due_date,
      assignerNote: assignment.assigner_note,
    };
    const completedSet = new Set(
      (completions ?? []).map((c) => c.step_number),
    );
    const employeeName =
      userRow?.full_name ?? userRow?.email ?? "there";

    const blocks = buildAssignmentMessage(
      assignmentData,
      (steps ?? []) as StepData[],
      employeeName,
      completedSet,
    );

    const convoResp = await this.client.conversations.open({
      users: slackUserId,
    });
    const channelId = convoResp.channel?.id;
    if (!channelId) return;

    await this.client.chat.update({
      channel: channelId,
      ts: notif.slack_message_ts,
      blocks,
      text: `Training plan update: ${planTitle}`,
    });
  }

  async sendWeeklyDigest(channelId: string, digest: DigestPayload) {
    const blocks = buildWeeklyDigestMessage(digest);
    await this.client.chat.postMessage({
      channel: channelId,
      blocks,
      text: `Weekly Digest: ${digest.orgName}`,
    });
  }
}
