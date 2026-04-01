import { Resend } from "resend";
import { render } from "@react-email/components";

import AssignmentEmail, {
  type AssignmentEmailProps,
} from "@/emails/AssignmentEmail";
import NudgeEmail, { type NudgeEmailProps } from "@/emails/NudgeEmail";
import WeeklyDigestEmail, {
  type WeeklyDigestEmailProps,
} from "@/emails/WeeklyDigestEmail";
import { getPublicAppOrigin } from "@/lib/public-app-url";

function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Recaller <onboarding@resend.dev>";

export type AssignmentNotification = {
  assignmentId: string;
  planTitle: string;
  steps: {
    stepNumber: number;
    title: string;
    instructions: string;
    proofInstructions: string;
  }[];
  dueDate: string | null;
  assignerNote: string | null;
  employeeName: string;
};

export type NudgeNotification = {
  assignmentId: string;
  planTitle: string;
  stepNumber: number;
  stepTitle: string;
  stepInstructions: string;
  proofInstructions: string;
  employeeName: string;
};

export type DigestNotification = {
  adminName: string;
  orgName: string;
  totalAssignments: number;
  completedThisWeek: number;
  activeEmployees: number;
  topCompletions: { name: string; count: number }[];
};

export class EmailNotifier {
  async sendAssignment(
    email: string,
    notification: AssignmentNotification,
  ): Promise<void> {
    const appUrl = getPublicAppOrigin();
    const props: AssignmentEmailProps = {
      employeeName: notification.employeeName,
      planTitle: notification.planTitle,
      steps: notification.steps,
      dueDate: notification.dueDate,
      assignerNote: notification.assignerNote,
      appUrl,
      assignmentId: notification.assignmentId,
    };

    const html = await render(AssignmentEmail(props));

    await resend().emails.send({
      from: FROM,
      to: email,
      subject: `New training plan: ${notification.planTitle}`,
      html,
    });
  }

  async sendNudge(
    email: string,
    notification: NudgeNotification,
  ): Promise<void> {
    const appUrl = getPublicAppOrigin();
    const props: NudgeEmailProps = {
      employeeName: notification.employeeName,
      planTitle: notification.planTitle,
      stepNumber: notification.stepNumber,
      stepTitle: notification.stepTitle,
      stepInstructions: notification.stepInstructions,
      proofInstructions: notification.proofInstructions,
      appUrl,
      assignmentId: notification.assignmentId,
    };

    const html = await render(NudgeEmail(props));

    await resend().emails.send({
      from: FROM,
      to: email,
      subject: `Reminder: Step ${notification.stepNumber} of ${notification.planTitle}`,
      html,
    });
  }

  async sendStepConfirmation(
    email: string,
    params: {
      employeeName: string;
      planTitle: string;
      stepNumber: number;
      totalSteps: number;
    },
  ): Promise<void> {
    const appUrl = getPublicAppOrigin();
    const allDone = params.stepNumber >= params.totalSteps;
    const subject = allDone
      ? `🎉 You completed ${params.planTitle}!`
      : `Step ${params.stepNumber} of ${params.planTitle} complete`;
    const body = allDone
      ? `Great job, ${params.employeeName}! You've completed all ${params.totalSteps} steps of "${params.planTitle}".`
      : `Nice work, ${params.employeeName}! You finished step ${params.stepNumber} of ${params.totalSteps} on "${params.planTitle}". Keep going!`;

    await resend().emails.send({
      from: FROM,
      to: email,
      subject,
      html: `<p>${body}</p><p><a href="${appUrl}/employee/my-plans">View your plans</a></p>`,
    });
  }

  async sendWeeklyDigest(
    email: string,
    notification: DigestNotification,
  ): Promise<void> {
    const appUrl = getPublicAppOrigin();
    const props: WeeklyDigestEmailProps = {
      adminName: notification.adminName,
      orgName: notification.orgName,
      totalAssignments: notification.totalAssignments,
      completedThisWeek: notification.completedThisWeek,
      activeEmployees: notification.activeEmployees,
      topCompletions: notification.topCompletions,
      appUrl,
    };

    const html = await render(WeeklyDigestEmail(props));

    await resend().emails.send({
      from: FROM,
      to: email,
      subject: `${notification.orgName} — Weekly Training Digest`,
      html,
    });
  }
}
