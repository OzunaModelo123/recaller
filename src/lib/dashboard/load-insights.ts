import { createAdminClient } from "@/lib/supabase/admin";
import { computeOrgInsights, type OrgInsightsBundle } from "@/lib/dashboard/orgInsights";

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

export type LiveAnalyticsPayload = OrgInsightsBundle & {
  periodLabel: string;
};

export async function loadLiveAnalytics(
  orgId: string,
  timeZone?: string,
): Promise<LiveAnalyticsPayload> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = now;

  const bundle = await computeOrgInsights(orgId, periodStart, periodEnd, timeZone);

  return {
    ...bundle,
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
