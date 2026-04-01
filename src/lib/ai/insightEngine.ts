import { createAdminClient } from "@/lib/supabase/admin";
import { computeOrgInsights } from "@/lib/dashboard/orgInsights";
import { anthropicClient, NARRATIVE_MODEL } from "./modelRouter";

/**
 * Monthly narrative uses the same computed bundle as the live Insights dashboard
 * so AI commentary always aligns with trackable metrics (assignments, steps, completions).
 */
export async function generateMonthlyReport(
  orgId: string,
  orgName: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ aiContent: string }> {
  const bundle = await computeOrgInsights(orgId, periodStart, periodEnd);

  const periodLabel = `${periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  const prompt = `You are a corporate learning analytics expert. The JSON below is computed from real product data only: assignments (excluding cancelled), plan step counts, step completions with timestamps, evidence payloads, and platform (web/slack/teams). There is no fabricated data.

Organisation: "${orgName}"
Period: ${periodLabel}

Rules:
- Reference specific numbers from the JSON. If a metric is 0 or null, say there is not enough data — do not invent trends.
- Explain the cumulative step funnel: each step N counts assignments whose highest completed step is at least N (among people who started).
- "avgStepProgress*" is average of (completed distinct steps ÷ expected steps per plan) per assignment.
- Call out overdue assignments, not-started work, proof/evidence rate, and platform mix when relevant.

Full analytics bundle:
${JSON.stringify(bundle)}

Write a concise monthly insight report (800–1200 words) with: executive summary (3 sentences), key findings (5 bullets), risks, recommendations, and one positive highlight. Audience: Director of L&D. Professional, accessible tone.`;

  const response = await anthropicClient.messages.create({
    model: NARRATIVE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const aiContent =
    response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n\n") || "Report generation did not produce content.";

  const sb = createAdminClient();
  await sb.from("insight_reports").insert({
    org_id: orgId,
    report_type: "monthly",
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    ai_content: aiContent,
  });

  return { aiContent };
}
