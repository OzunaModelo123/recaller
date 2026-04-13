/**
 * Unified notification router.
 * Resolves each user's preferred platform (Slack → Teams → email),
 * enforces suppression windows, and logs every send.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { openSlackBotToken } from "@/lib/slack/bot-token-crypto";
import { SlackNotifier } from "./SlackNotifier";
import { TeamsNotifier } from "./TeamsNotifier";
import {
  EmailNotifier,
  type AssignmentNotification,
  type NudgeNotification,
  type DigestNotification,
} from "./EmailNotifier";
import type { StepData } from "@/lib/slack/blockKit";

export type Platform = "slack" | "teams" | "email";

type UserPlatformInfo = {
  platform: Platform;
  slackUserId?: string;
  teamsUserId?: string;
  email: string;
  fullName: string;
};

const NUDGE_SUPPRESSION_HOURS = 72;

export class NotificationService {
  private emailNotifier = new EmailNotifier();

  /**
   * Determine the best delivery channel for a specific user in an org.
   */
  async resolvePlatform(
    orgId: string,
    userId: string,
  ): Promise<UserPlatformInfo> {
    const sb = createAdminClient();

    const [orgResult, userResult] = await Promise.all([
      sb
        .from("organisations")
        .select("slack_team_id, teams_tenant_id")
        .eq("id", orgId)
        .maybeSingle(),
      sb
        .from("users")
        .select(
          "email, full_name, slack_user_id, slack_employee_linked_at, teams_user_id",
        )
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const org = orgResult.data;
    const user = userResult.data;

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const base = {
      email: user.email,
      fullName: user.full_name ?? user.email.split("@")[0],
    };

    if (
      org?.slack_team_id &&
      user.slack_user_id &&
      user.slack_employee_linked_at
    ) {
      return {
        ...base,
        platform: "slack",
        slackUserId: user.slack_user_id,
      };
    }

    if (org?.teams_tenant_id && user.teams_user_id) {
      return {
        ...base,
        platform: "teams",
        teamsUserId: user.teams_user_id,
      };
    }

    return { ...base, platform: "email" };
  }

  /**
   * Check if a notification type is currently suppressed for this user.
   */
  async isSuppressed(
    userId: string,
    notificationType: string,
  ): Promise<boolean> {
    const sb = createAdminClient();
    const { data } = await sb
      .from("notification_suppressions")
      .select("id")
      .eq("user_id", userId)
      .eq("notification_type", notificationType)
      .gte("suppressed_until", new Date().toISOString())
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  /**
   * Record a suppression window (e.g. 72h for nudges).
   */
  async addSuppression(
    userId: string,
    notificationType: string,
    hours: number,
  ): Promise<void> {
    const sb = createAdminClient();
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await sb.from("notification_suppressions").insert({
      user_id: userId,
      notification_type: notificationType,
      suppressed_until: until,
    });
  }

  /**
   * Log a notification send to the `notifications` table.
   */
  private async log(params: {
    orgId: string;
    userId: string;
    type: string;
    channel: Platform;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const sb = createAdminClient();
    await sb.from("notifications").insert({
      org_id: params.orgId,
      user_id: params.userId,
      type: params.type,
      channel: params.channel,
      payload: params.payload ?? {},
      sent_at: new Date().toISOString(),
    });
  }

  /**
   * Resolve a Slack bot token for an org (or null).
   */
  private async slackBotToken(orgId: string): Promise<string | null> {
    const sb = createAdminClient();
    const { data: inst } = await sb
      .from("slack_installations")
      .select("bot_token_encrypted")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!inst?.bot_token_encrypted) return null;

    try {
      return openSlackBotToken(inst.bot_token_encrypted);
    } catch {
      return null;
    }
  }

  // ──────────── Assignment notification ────────────

  async sendAssignment(
    orgId: string,
    userId: string,
    params: {
      assignmentId: string;
      planTitle: string;
      steps: StepData[];
      dueDate: string | null;
      assignerNote: string | null;
    },
  ): Promise<void> {
    const info = await this.resolvePlatform(orgId, userId);

    if (info.platform === "slack" && info.slackUserId) {
      const token = await this.slackBotToken(orgId);
      if (token) {
        const notifier = new SlackNotifier(token);
        await notifier.sendAssignment(info.slackUserId, {
          assignmentId: params.assignmentId,
          orgId,
          userId,
        });
        return;
      }
    }

    if (info.platform === "teams" && info.teamsUserId) {
      try {
        const notifier = new TeamsNotifier();
        await notifier.sendAssignment(info.teamsUserId, {
          assignmentId: params.assignmentId,
          orgId,
          userId,
        });
        return;
      } catch (e) {
        console.error("[NotificationService] Teams assignment failed, falling back to email", e);
      }
    }

    const emailPayload: AssignmentNotification = {
      assignmentId: params.assignmentId,
      planTitle: params.planTitle,
      steps: params.steps.map((s) => ({
        stepNumber: s.step_number,
        title: s.title,
        instructions: s.instructions,
        proofInstructions: s.proof_instructions,
      })),
      dueDate: params.dueDate,
      assignerNote: params.assignerNote,
      employeeName: info.fullName,
    };

    try {
      await this.emailNotifier.sendAssignment(info.email, emailPayload);
      await this.log({
        orgId,
        userId,
        type: "assignment",
        channel: "email",
        payload: { assignmentId: params.assignmentId, planTitle: params.planTitle },
      });
    } catch (e) {
      console.error("[NotificationService] Email assignment failed", e);
    }
  }

  // ──────────── Nudge ────────────

  async sendNudge(
    orgId: string,
    userId: string,
    params: {
      assignmentId: string;
      planTitle: string;
      currentStep: StepData;
    },
  ): Promise<boolean> {
    if (await this.isSuppressed(userId, "nudge")) {
      return false;
    }

    const info = await this.resolvePlatform(orgId, userId);

    if (info.platform === "slack" && info.slackUserId) {
      const token = await this.slackBotToken(orgId);
      if (token) {
        const notifier = new SlackNotifier(token);
        await notifier.sendNudge(info.slackUserId, {
          assignmentId: params.assignmentId,
          currentStep: params.currentStep,
          planTitle: params.planTitle,
          orgId,
          userId,
        });
        await this.addSuppression(userId, "nudge", NUDGE_SUPPRESSION_HOURS);
        await this.log({
          orgId,
          userId,
          type: "nudge",
          channel: "slack",
          payload: {
            assignmentId: params.assignmentId,
            stepNumber: params.currentStep.step_number,
          },
        });
        return true;
      }
    }

    if (info.platform === "teams" && info.teamsUserId) {
      try {
        const notifier = new TeamsNotifier();
        await notifier.sendNudge(info.teamsUserId, {
          assignmentId: params.assignmentId,
          currentStep: params.currentStep,
          planTitle: params.planTitle,
          orgId,
          userId,
        });
        await this.addSuppression(userId, "nudge", NUDGE_SUPPRESSION_HOURS);
        await this.log({
          orgId,
          userId,
          type: "nudge",
          channel: "teams",
          payload: {
            assignmentId: params.assignmentId,
            stepNumber: params.currentStep.step_number,
          },
        });
        return true;
      } catch (e) {
        console.error("[NotificationService] Teams nudge failed, falling back to email", e);
      }
    }

    const nudgePayload: NudgeNotification = {
      assignmentId: params.assignmentId,
      planTitle: params.planTitle,
      stepNumber: params.currentStep.step_number,
      stepTitle: params.currentStep.title,
      stepInstructions: params.currentStep.instructions,
      proofInstructions: params.currentStep.proof_instructions,
      employeeName: info.fullName,
    };

    try {
      await this.emailNotifier.sendNudge(info.email, nudgePayload);
      await this.addSuppression(userId, "nudge", NUDGE_SUPPRESSION_HOURS);
      await this.log({
        orgId,
        userId,
        type: "nudge",
        channel: "email",
        payload: {
          assignmentId: params.assignmentId,
          stepNumber: params.currentStep.step_number,
        },
      });
      return true;
    } catch (e) {
      console.error("[NotificationService] Email nudge failed", e);
      return false;
    }
  }

  // ──────────── Daily Recall ────────────

  async sendDailyRecallNudge(orgId: string, userId: string): Promise<void> {
    const info = await this.resolvePlatform(orgId, userId);

    if (info.platform === "slack" && info.slackUserId) {
      const token = await this.slackBotToken(orgId);
      if (token) {
        console.log(`[Slack] Sending Daily Recall Nudge to ${info.slackUserId}`);
        await this.log({ orgId, userId, type: "daily_recall", channel: "slack" });
        return;
      }
    }

    if (info.platform === "teams" && info.teamsUserId) {
      console.log(`[Teams] Sending Daily Recall Nudge to ${info.teamsUserId}`);
      await this.log({ orgId, userId, type: "daily_recall", channel: "teams" });
      return;
    }

    console.log(`[Email] Sending Daily Recall Nudge to ${info.email}`);
    await this.log({ orgId, userId, type: "daily_recall", channel: "email" });
  }

  // ──────────── Step confirmation ────────────

  async sendStepConfirmation(
    orgId: string,
    userId: string,
    params: {
      assignmentId: string;
      planTitle: string;
      stepNumber: number;
      totalSteps: number;
      platform: "web" | "slack" | "teams";
    },
  ): Promise<void> {
    const info = await this.resolvePlatform(orgId, userId);

    if (params.platform === "web" && info.platform === "slack" && info.slackUserId) {
      const token = await this.slackBotToken(orgId);
      if (token) {
        const notifier = new SlackNotifier(token);
        await notifier.sendStepConfirmation(info.slackUserId, params.assignmentId);
      }
    }
    if (params.platform === "web" && info.platform === "teams" && info.teamsUserId) {
      const notifier = new TeamsNotifier();
      await notifier.sendStepConfirmation(info.teamsUserId, params.assignmentId);
    }

    if (info.platform === "email") {
      try {
        await this.emailNotifier.sendStepConfirmation(info.email, {
          employeeName: info.fullName,
          planTitle: params.planTitle,
          stepNumber: params.stepNumber,
          totalSteps: params.totalSteps,
        });
      } catch (e) {
        console.error("[NotificationService] Email step confirmation failed", e);
      }
    }
  }

  // ──────────── Weekly digest ────────────

  async sendWeeklyDigest(
    orgId: string,
    digest: Omit<DigestNotification, "adminName"> & {
      slackChannelId?: string;
      teamsChannelId?: string;
    },
  ): Promise<void> {
    const sb = createAdminClient();

    if (digest.slackChannelId) {
      const token = await this.slackBotToken(orgId);
      if (token) {
        const notifier = new SlackNotifier(token);
        await notifier.sendWeeklyDigest(digest.slackChannelId, {
          orgName: digest.orgName,
          totalAssignments: digest.totalAssignments,
          completedThisWeek: digest.completedThisWeek,
          activeEmployees: digest.activeEmployees,
          topCompletions: digest.topCompletions,
        });
      }
    }

    if (digest.teamsChannelId) {
      const notifier = new TeamsNotifier();
      await notifier.sendWeeklyDigest(orgId, digest.teamsChannelId, {
        orgName: digest.orgName,
        totalAssignments: digest.totalAssignments,
        completedThisWeek: digest.completedThisWeek,
        activeEmployees: digest.activeEmployees,
        topCompletions: digest.topCompletions,
      });
    }

    const { data: admins } = await sb
      .from("users")
      .select("email, full_name")
      .eq("org_id", orgId)
      .in("role", ["admin", "super_admin"]);

    for (const admin of admins ?? []) {
      try {
        await this.emailNotifier.sendWeeklyDigest(admin.email, {
          adminName: admin.full_name ?? admin.email.split("@")[0],
          orgName: digest.orgName,
          totalAssignments: digest.totalAssignments,
          completedThisWeek: digest.completedThisWeek,
          activeEmployees: digest.activeEmployees,
          topCompletions: digest.topCompletions,
        });
      } catch (e) {
        console.error("[NotificationService] Weekly digest email failed for", admin.email, e);
      }
    }
  }
}

export const notificationService = new NotificationService();
