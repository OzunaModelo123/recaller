/**
 * Proactive Teams notification sender.
 * Creates 1:1 conversations with users via Bot Connector REST API
 * and sends Adaptive Cards for assignments, nudges, and digests.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendActivity,
  createConversation,
  type Activity,
} from "@/lib/teams/restClient";
import {
  buildAssignmentCard,
  buildNudgeCard,
  buildWeeklyDigestCard,
  type StepData,
  type AssignmentData,
  type DigestPayload,
} from "@/lib/teams/adaptiveCards";

function cardActivity(card: unknown): Activity {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card,
      },
    ],
  };
}

async function getTeamsInstallation(orgId: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from("teams_installations")
    .select("service_url, tenant_id")
    .eq("org_id", orgId)
    .maybeSingle();
  return data;
}

export class TeamsNotifier {
  /**
   * Opens (or reuses) a 1:1 and posts the assignment Adaptive Card.
   * @returns Teams activity id for the sent message
   */
  async sendAssignment(
    teamsUserId: string,
    notification: {
      assignmentId: string;
      orgId: string;
      userId: string;
    },
  ): Promise<string> {
    const sb = createAdminClient();

    const { data: assignee } = await sb
      .from("users")
      .select("teams_user_id")
      .eq("id", notification.userId)
      .maybeSingle();

    if (!assignee?.teams_user_id) {
      throw new Error("Assignee has no teams_user_id");
    }

    const inst = await getTeamsInstallation(notification.orgId);
    if (!inst?.service_url || !inst.tenant_id) {
      throw new Error("Teams installation missing service_url or tenant_id");
    }

    const { data: assignment } = await sb
      .from("assignments")
      .select(
        "id, plan_id, due_date, assigner_note, assigned_to, org_id, plans(title)",
      )
      .eq("id", notification.assignmentId)
      .single();
    if (!assignment || assignment.org_id !== notification.orgId) {
      throw new Error("Assignment not found or org mismatch");
    }

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

    const card = buildAssignmentCard(
      assignmentData,
      (steps ?? []) as StepData[],
      employeeName,
      completedSet,
    );

    try {
      const convo = await createConversation(
        inst.service_url,
        inst.tenant_id,
        teamsUserId,
      );

      const result = await sendActivity(
        inst.service_url,
        convo.id,
        cardActivity(card),
      );

      if (!result.id) {
        throw new Error("Teams sendActivity returned no activity id");
      }

      await sb.from("notifications").insert({
        org_id: notification.orgId,
        user_id: notification.userId,
        type: "assignment",
        channel: "teams",
        payload: {
          assignmentId: assignment.id,
          planTitle,
          teamsConversationId: convo.id,
        },
        teams_activity_id: result.id,
        sent_at: new Date().toISOString(),
      });

      return result.id;
    } catch (e) {
      console.error("[TeamsNotifier] sendAssignment failed", e);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  async sendNudge(
    teamsUserId: string,
    nudge: {
      assignmentId: string;
      currentStep: StepData;
      planTitle: string;
      orgId: string;
      userId: string;
    },
  ) {
    const inst = await getTeamsInstallation(nudge.orgId);
    if (!inst?.service_url || !inst.tenant_id) return;

    const assignmentData: AssignmentData = {
      id: nudge.assignmentId,
      planTitle: nudge.planTitle,
      dueDate: null,
      assignerNote: null,
    };

    const card = buildNudgeCard(assignmentData, nudge.currentStep);

    try {
      const convo = await createConversation(
        inst.service_url,
        inst.tenant_id,
        teamsUserId,
      );

      await sendActivity(
        inst.service_url,
        convo.id,
        cardActivity(card),
      );
    } catch (e) {
      console.error("[TeamsNotifier] sendNudge failed", e);
    }
  }

  /**
   * For Teams, step confirmation updates happen in-place via the invoke response
   * in the messages route handler. This is a no-op.
   */
  async sendStepConfirmation(
    _teamsUserId: string,
    _assignmentId: string,
  ): Promise<void> {
    // Card updates in-place via Action.Submit invoke response — no separate message needed
  }

  async sendWeeklyDigest(
    orgId: string,
    channelConversationId: string,
    digest: DigestPayload,
  ) {
    const inst = await getTeamsInstallation(orgId);
    if (!inst?.service_url) return;

    const card = buildWeeklyDigestCard(digest);

    try {
      await sendActivity(
        inst.service_url,
        channelConversationId,
        cardActivity(card),
      );
    } catch (e) {
      console.error("[TeamsNotifier] sendWeeklyDigest failed", e);
    }
  }
}
