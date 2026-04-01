import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicClient, NARRATIVE_MODEL } from "./modelRouter";

type VelocityResult = {
  medianTimeToStartHours: number;
  medianTimeToFinishHours: number;
  fastestCompletionHours: number;
  slowestCompletionHours: number;
  totalCompleted: number;
};

type DropOffResult = {
  stepCounts: { step: number; count: number }[];
  biggestDropStep: number;
  biggestDropPercentage: number;
  hardStepNotes: string[];
};

type CategoryEngagementResult = {
  category: string;
  avgCompletionRate: number;
  totalAssignments: number;
  totalCompletions: number;
}[];

type HeatmapResult = { hour: number; completionCount: number }[];

type PerformerRankingResult = {
  topPerformers: { name: string; rate: number }[];
  bottomPerformers: { name: string; rate: number }[];
  orgAverage: number;
};

type ContentEffectivenessResult = {
  planTitle: string;
  contentType: string;
  completionRate: number;
  totalAssigned: number;
}[];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function hoursElapsed(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60);
}

export async function completionVelocity(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<VelocityResult> {
  const sb = createAdminClient();
  const { data: assignments } = await sb
    .from("assignments")
    .select("id, created_at")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  const timesToStart: number[] = [];
  const timesToFinish: number[] = [];

  for (const a of assignments ?? []) {
    const { data: completions } = await sb
      .from("step_completions")
      .select("completed_at")
      .eq("assignment_id", a.id)
      .order("completed_at", { ascending: true });

    if (!completions?.length) continue;
    const first = completions[0].completed_at;
    const last = completions[completions.length - 1].completed_at;
    timesToStart.push(hoursElapsed(a.created_at, first));
    timesToFinish.push(hoursElapsed(first, last));
  }

  return {
    medianTimeToStartHours: Math.round(median(timesToStart) * 10) / 10,
    medianTimeToFinishHours: Math.round(median(timesToFinish) * 10) / 10,
    fastestCompletionHours:
      timesToFinish.length > 0 ? Math.round(Math.min(...timesToFinish) * 10) / 10 : 0,
    slowestCompletionHours:
      timesToFinish.length > 0 ? Math.round(Math.max(...timesToFinish) * 10) / 10 : 0,
    totalCompleted: (assignments ?? []).length,
  };
}

export async function dropOffAnalysis(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<DropOffResult> {
  const sb = createAdminClient();
  const { data: orgAssignments } = await sb
    .from("assignments")
    .select("id")
    .eq("org_id", orgId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  const assignmentIds = (orgAssignments ?? []).map((a) => a.id);
  if (assignmentIds.length === 0) {
    return { stepCounts: [], biggestDropStep: 0, biggestDropPercentage: 0, hardStepNotes: [] };
  }

  const { data: completions } = await sb
    .from("step_completions")
    .select("step_number, difficulty_rating, note")
    .in("assignment_id", assignmentIds);

  const stepCountMap = new Map<number, Set<string>>();
  for (const c of completions ?? []) {
    if (!stepCountMap.has(c.step_number)) stepCountMap.set(c.step_number, new Set());
  }

  const { data: completionsWithAssignment } = await sb
    .from("step_completions")
    .select("assignment_id, step_number")
    .in("assignment_id", assignmentIds);

  const userByAssignment = new Map<string, string>();
  for (const a of orgAssignments ?? []) {
    userByAssignment.set(a.id, a.id);
  }

  for (const c of completionsWithAssignment ?? []) {
    if (!stepCountMap.has(c.step_number)) stepCountMap.set(c.step_number, new Set());
    stepCountMap.get(c.step_number)!.add(c.assignment_id);
  }

  const stepCounts = [...stepCountMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, set]) => ({ step, count: set.size }));

  let biggestDropStep = 0;
  let biggestDropPct = 0;
  for (let i = 1; i < stepCounts.length; i++) {
    const prev = stepCounts[i - 1].count;
    const curr = stepCounts[i].count;
    if (prev > 0) {
      const drop = ((prev - curr) / prev) * 100;
      if (drop > biggestDropPct) {
        biggestDropPct = drop;
        biggestDropStep = stepCounts[i].step;
      }
    }
  }

  const hardStepNotes = (completions ?? [])
    .filter(
      (c) =>
        c.step_number === biggestDropStep &&
        c.difficulty_rating != null &&
        c.difficulty_rating >= 4 &&
        c.note,
    )
    .map((c) => c.note!)
    .slice(0, 5);

  return {
    stepCounts,
    biggestDropStep,
    biggestDropPercentage: Math.round(biggestDropPct),
    hardStepNotes,
  };
}

export async function categoryEngagement(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CategoryEngagementResult> {
  const sb = createAdminClient();
  const { data: plans } = await sb
    .from("plans")
    .select("id, category")
    .eq("org_id", orgId);

  const { data: orgAssignments } = await sb
    .from("assignments")
    .select("id, plan_id, status")
    .eq("org_id", orgId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  const planCategoryMap = new Map<string, string>();
  for (const p of plans ?? []) {
    planCategoryMap.set(p.id, p.category ?? "Uncategorized");
  }

  const catStats = new Map<string, { total: number; completed: number }>();
  for (const a of orgAssignments ?? []) {
    const cat = planCategoryMap.get(a.plan_id) ?? "Uncategorized";
    if (!catStats.has(cat)) catStats.set(cat, { total: 0, completed: 0 });
    const s = catStats.get(cat)!;
    s.total++;
    if (a.status === "completed") s.completed++;
  }

  return [...catStats.entries()].map(([category, s]) => ({
    category,
    avgCompletionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    totalAssignments: s.total,
    totalCompletions: s.completed,
  }));
}

export async function timeOfDayHeatmap(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<HeatmapResult> {
  const sb = createAdminClient();
  const { data: orgAssignments } = await sb
    .from("assignments")
    .select("id")
    .eq("org_id", orgId);

  const ids = (orgAssignments ?? []).map((a) => a.id);
  if (ids.length === 0) return Array.from({ length: 24 }, (_, h) => ({ hour: h, completionCount: 0 }));

  const { data: completions } = await sb
    .from("step_completions")
    .select("completed_at")
    .in("assignment_id", ids)
    .gte("completed_at", periodStart.toISOString())
    .lte("completed_at", periodEnd.toISOString());

  const hourCounts = new Array(24).fill(0);
  for (const c of completions ?? []) {
    const hour = new Date(c.completed_at).getUTCHours();
    hourCounts[hour]++;
  }

  return hourCounts.map((count, hour) => ({ hour, completionCount: count }));
}

export async function performerRanking(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PerformerRankingResult> {
  const sb = createAdminClient();
  const { data: orgAssignments } = await sb
    .from("assignments")
    .select("id, assigned_to, plan_id, status")
    .eq("org_id", orgId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  const userAssignments = new Map<string, { total: number; completed: number }>();
  for (const a of orgAssignments ?? []) {
    if (!userAssignments.has(a.assigned_to))
      userAssignments.set(a.assigned_to, { total: 0, completed: 0 });
    const s = userAssignments.get(a.assigned_to)!;
    s.total++;
    if (a.status === "completed") s.completed++;
  }

  const qualifiedUsers = [...userAssignments.entries()].filter(
    ([, s]) => s.total >= 2,
  );
  const rates = qualifiedUsers.map(([userId, s]) => ({
    userId,
    rate: Math.round((s.completed / s.total) * 100),
  }));

  rates.sort((a, b) => b.rate - a.rate);

  const { data: users } = await sb
    .from("users")
    .select("id, full_name, email")
    .eq("org_id", orgId);

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.full_name ?? u.email.split("@")[0]);
  }

  const allRates = rates.map((r) => r.rate);
  const orgAverage = allRates.length > 0
    ? Math.round(allRates.reduce((a, b) => a + b, 0) / allRates.length)
    : 0;

  return {
    topPerformers: rates.slice(0, 5).map((r) => ({
      name: nameMap.get(r.userId) ?? "Unknown",
      rate: r.rate,
    })),
    bottomPerformers: rates
      .slice(-3)
      .reverse()
      .map((r) => ({
        name: nameMap.get(r.userId) ?? "Unknown",
        rate: r.rate,
      })),
    orgAverage,
  };
}

export async function contentEffectiveness(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ContentEffectivenessResult> {
  const sb = createAdminClient();
  const { data: plans } = await sb
    .from("plans")
    .select("id, title, content_item_id")
    .eq("org_id", orgId);

  const { data: contentItems } = await sb
    .from("content_items")
    .select("id, source_type")
    .eq("org_id", orgId);

  const contentTypeMap = new Map<string, string>();
  for (const c of contentItems ?? []) {
    contentTypeMap.set(c.id, c.source_type);
  }

  const { data: orgAssignments } = await sb
    .from("assignments")
    .select("id, plan_id, status")
    .eq("org_id", orgId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  const planStats = new Map<string, { total: number; completed: number }>();
  for (const a of orgAssignments ?? []) {
    if (!planStats.has(a.plan_id))
      planStats.set(a.plan_id, { total: 0, completed: 0 });
    const s = planStats.get(a.plan_id)!;
    s.total++;
    if (a.status === "completed") s.completed++;
  }

  const planMap = new Map<string, { title: string; contentItemId: string | null }>();
  for (const p of plans ?? []) {
    planMap.set(p.id, { title: p.title, contentItemId: p.content_item_id });
  }

  return [...planStats.entries()]
    .map(([planId, s]) => {
      const plan = planMap.get(planId);
      return {
        planTitle: plan?.title ?? "Unknown",
        contentType: plan?.contentItemId
          ? contentTypeMap.get(plan.contentItemId) ?? "unknown"
          : "manual",
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        totalAssigned: s.total,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate);
}

export async function generateMonthlyReport(
  orgId: string,
  orgName: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ aiContent: string }> {
  const [velocity, dropOff, categories, heatmap, performers, effectiveness] =
    await Promise.all([
      completionVelocity(orgId, periodStart, periodEnd),
      dropOffAnalysis(orgId, periodStart, periodEnd),
      categoryEngagement(orgId, periodStart, periodEnd),
      timeOfDayHeatmap(orgId, periodStart, periodEnd),
      performerRanking(orgId, periodStart, periodEnd),
      contentEffectiveness(orgId, periodStart, periodEnd),
    ]);

  const periodLabel = `${periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  const prompt = `You are a corporate learning analytics expert. Given the following behavioral data from a training execution platform for "${orgName}" for ${periodLabel}, write a concise monthly insight report (800-1200 words).

Include: executive summary (3 sentences), key findings (5 bullets), areas of concern, recommendations, and a positive highlight. Write in a professional but accessible tone. The audience is a Director of L&D.

Data:
- Completion velocity: ${JSON.stringify(velocity)}
- Drop-off analysis: ${JSON.stringify(dropOff)}
- Category engagement: ${JSON.stringify(categories)}
- Time-of-day patterns: ${JSON.stringify(heatmap)}
- Performer rankings: ${JSON.stringify(performers)}
- Content effectiveness: ${JSON.stringify(effectiveness)}`;

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
