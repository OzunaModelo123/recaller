import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationService } from "@/lib/notifications/NotificationService";
import type { StepData } from "@/lib/slack/blockKit";

const STALL_HOURS = 48;

export const sendNudges = inngest.createFunction(
  {
    id: "send-nudges",
    name: "Send inactivity nudges",
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    const stalledAssignments = await step.run(
      "find-stalled-assignments",
      async () => {
        const sb = createAdminClient();
        const cutoff = new Date(
          Date.now() - STALL_HOURS * 60 * 60 * 1000,
        ).toISOString();

        const { data: activeAssignments, error } = await sb
          .from("assignments")
          .select(
            "id, org_id, assigned_to, plan_id, created_at, plans(title)",
          )
          .eq("status", "active");

        if (error || !activeAssignments) return [];

        const stalled: {
          assignmentId: string;
          orgId: string;
          userId: string;
          planId: string;
          planTitle: string;
          createdAt: string;
        }[] = [];

        for (const a of activeAssignments) {
          const { data: lastCompletion } = await sb
            .from("step_completions")
            .select("completed_at")
            .eq("assignment_id", a.id)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastActivity = lastCompletion?.completed_at ?? a.created_at;

          if (lastActivity && new Date(lastActivity) < new Date(cutoff)) {
            const planTitle =
              (a as unknown as { plans: { title: string } | null }).plans
                ?.title ?? "Training Plan";
            stalled.push({
              assignmentId: a.id,
              orgId: a.org_id,
              userId: a.assigned_to,
              planId: a.plan_id,
              planTitle,
              createdAt: a.created_at,
            });
          }
        }

        return stalled;
      },
    );

    let sent = 0;
    let suppressed = 0;

    for (const assignment of stalledAssignments) {
      await step.run(
        `nudge-${assignment.assignmentId}`,
        async () => {
          const sb = createAdminClient();

          const { data: steps } = await sb
            .from("plan_steps")
            .select(
              "step_number, title, instructions, success_criteria, proof_type, proof_instructions, estimated_minutes",
            )
            .eq("plan_id", assignment.planId)
            .order("step_number", { ascending: true });

          const { data: completions } = await sb
            .from("step_completions")
            .select("step_number")
            .eq("assignment_id", assignment.assignmentId);

          const completedSet = new Set(
            (completions ?? []).map((c) => c.step_number),
          );

          const currentStep = (steps ?? []).find(
            (s) => !completedSet.has(s.step_number),
          ) as StepData | undefined;

          if (!currentStep) return;

          const didSend = await notificationService.sendNudge(
            assignment.orgId,
            assignment.userId,
            {
              assignmentId: assignment.assignmentId,
              planTitle: assignment.planTitle,
              currentStep,
            },
          );

          if (didSend) {
            sent++;
          } else {
            suppressed++;
          }
        },
      );
    }

    return { stalled: stalledAssignments.length, sent, suppressed };
  },
);
