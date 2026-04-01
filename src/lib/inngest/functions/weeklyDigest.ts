import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationService } from "@/lib/notifications/NotificationService";

export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    name: "Weekly training digest",
    triggers: [{ cron: "TZ=America/New_York 0 9 * * 1" }],
  },
  async ({ step }) => {
    const orgs = await step.run("list-orgs", async () => {
      const sb = createAdminClient();
      const { data } = await sb
        .from("organisations")
        .select("id, name, slack_admin_channel_id, teams_tenant_id");
      return data ?? [];
    });

    for (const org of orgs) {
      await step.run(`digest-${org.id}`, async () => {
        const sb = createAdminClient();

        const oneWeekAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { count: totalAssignments } = await sb
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .eq("status", "active");

        const { data: recentCompletions } = await sb
          .from("step_completions")
          .select("id, assignment_id")
          .gte("completed_at", oneWeekAgo);

        const orgAssignmentIds = new Set<string>();
        const { data: orgAssignments } = await sb
          .from("assignments")
          .select("id, assigned_to")
          .eq("org_id", org.id);
        for (const a of orgAssignments ?? []) {
          orgAssignmentIds.add(a.id);
        }

        const orgCompletions = (recentCompletions ?? []).filter((c) =>
          orgAssignmentIds.has(c.assignment_id),
        );

        const activeEmployeeIds = new Set(
          (orgAssignments ?? [])
            .filter((a) => orgAssignmentIds.has(a.id))
            .map((a) => a.assigned_to),
        );

        const completionsByUser = new Map<string, number>();
        for (const c of orgCompletions) {
          const assignment = (orgAssignments ?? []).find(
            (a) => a.id === c.assignment_id,
          );
          if (assignment) {
            const prev = completionsByUser.get(assignment.assigned_to) ?? 0;
            completionsByUser.set(assignment.assigned_to, prev + 1);
          }
        }

        const { data: orgUsers } = await sb
          .from("users")
          .select("id, full_name, email")
          .eq("org_id", org.id);

        const userNameMap = new Map<string, string>();
        for (const u of orgUsers ?? []) {
          userNameMap.set(u.id, u.full_name ?? u.email.split("@")[0]);
        }

        const topCompletions = [...completionsByUser.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([uid, count]) => ({
            name: userNameMap.get(uid) ?? "Unknown",
            count,
          }));

        await notificationService.sendWeeklyDigest(org.id, {
          orgName: org.name,
          totalAssignments: totalAssignments ?? 0,
          completedThisWeek: orgCompletions.length,
          activeEmployees: activeEmployeeIds.size,
          topCompletions,
          slackChannelId: org.slack_admin_channel_id ?? undefined,
        });
      });
    }

    return { orgsProcessed: orgs.length };
  },
);
