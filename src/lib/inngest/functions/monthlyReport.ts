import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMonthlyReport } from "@/lib/ai/insightEngine";

const MIN_COMPLETED_ASSIGNMENTS = 10;

export const monthlyReport = inngest.createFunction(
  {
    id: "monthly-report",
    name: "Generate monthly insight reports",
    triggers: [{ cron: "TZ=America/New_York 0 6 1 * *" }],
  },
  async ({ step }) => {
    const orgs = await step.run("list-orgs-with-subs", async () => {
      const sb = createAdminClient();
      const { data } = await sb
        .from("organisations")
        .select("id, name");
      return data ?? [];
    });

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);

    let generated = 0;
    let skipped = 0;

    for (const org of orgs) {
      await step.run(`report-${org.id}`, async () => {
        const sb = createAdminClient();

        const { count } = await sb
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .eq("status", "completed")
          .gte("created_at", periodStart.toISOString())
          .lte("created_at", periodEnd.toISOString());

        if ((count ?? 0) < MIN_COMPLETED_ASSIGNMENTS) {
          console.log(
            `[monthlyReport] Insufficient data for org ${org.id} (${count} completed). Skipping.`,
          );
          skipped++;
          return;
        }

        try {
          await generateMonthlyReport(
            org.id,
            org.name,
            periodStart,
            periodEnd,
          );
          generated++;
        } catch (e) {
          console.error(`[monthlyReport] Failed for org ${org.id}`, e);
        }
      });
    }

    return { orgsChecked: orgs.length, generated, skipped };
  },
);
