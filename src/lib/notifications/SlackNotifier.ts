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

type AssignmentSlackPayload = {
  assignmentId: string;
  planTitle: string;
  /** DM channel id from chat.postMessage (D…) — required for reliable chat.update */
  slack_dm_channel_id?: string;
};

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
      const dmChannelId =
        typeof result.channel === "string" && result.channel.length > 0
          ? result.channel
          : undefined;
      const payload: AssignmentSlackPayload = {
        assignmentId: assignment.id,
        planTitle,
        ...(dmChannelId ? { slack_dm_channel_id: dmChannelId } : {}),
      };
      await sb.from("notifications").insert({
        org_id: notification.orgId,
        user_id: notification.userId,
        type: "assignment",
        channel: "slack",
        payload,
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

  async sendStepConfirmation(slackUserId: string, assignmentId: string) {
    const sb = createAdminClient();

    const { data: assignment } = await sb
      .from("assignments")
      .select(
        "id, plan_id, due_date, assigner_note, assigned_to, org_id, plans(title)",
      )
      .eq("id", assignmentId)
      .single();
    if (!assignment) return;

    const { data: notifRows, error: notifErr } = await sb
      .from("notifications")
      .select("slack_message_ts, payload")
      .eq("user_id", assignment.assigned_to)
      .eq("org_id", assignment.org_id)
      .eq("type", "assignment")
      .contains("payload", { assignmentId: assignment.id })
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (notifErr || !notifRows?.length) return;
    const notif = notifRows[0];
    if (!notif?.slack_message_ts) return;

    const storedPayload = notif.payload as AssignmentSlackPayload | null;
    const storedDmChannel = storedPayload?.slack_dm_channel_id?.trim();

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

    let channelId = storedDmChannel;
    if (!channelId) {
      const convoResp = await this.client.conversations.open({
        users: slackUserId,
      });
      channelId = convoResp.channel?.id;
    }
    if (!channelId) return;

    const update = await this.client.chat.update({
      channel: channelId,
      ts: notif.slack_message_ts,
      blocks,
      text: `Training plan update: ${planTitle}`,
    });
    if (!update.ok) {
      console.error(
        "[SlackNotifier] chat.update failed",
        update.error,
        update.response_metadata,
      );
    }
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
