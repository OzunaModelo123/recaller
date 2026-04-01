import { createAdminClient } from "@/lib/supabase/admin";
import {
  completionVelocity,
  dropOffAnalysis,
  categoryEngagement,
  timeOfDayHeatmap,
  performerRanking,
  contentEffectiveness,
} from "@/lib/ai/insightEngine";

export async function loadInsightReports(orgId: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from("insight_reports")
    .select("id, report_type, period_start, period_end, generated_at, ai_content, pdf_url")
    .eq("org_id", orgId)
    .order("generated_at", { ascending: false })
    .limit(12);

  return data ?? [];
}

export async function loadLiveAnalytics(orgId: string) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = now;

  const [velocity, dropOff, categories, heatmap, performers, effectiveness] =
    await Promise.all([
      completionVelocity(orgId, periodStart, periodEnd),
      dropOffAnalysis(orgId, periodStart, periodEnd),
      categoryEngagement(orgId, periodStart, periodEnd),
      timeOfDayHeatmap(orgId, periodStart, periodEnd),
      performerRanking(orgId, periodStart, periodEnd),
      contentEffectiveness(orgId, periodStart, periodEnd),
    ]);

  return {
    velocity,
    dropOff,
    categories,
    heatmap,
    performers,
    effectiveness,
    periodLabel: `${periodStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${periodEnd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`,
  };
}
