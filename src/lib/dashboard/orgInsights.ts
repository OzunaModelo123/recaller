/**
 * Employer-facing org analytics — every metric is derived from
 * assignments, plan_steps, step_completions, plans, content_items, users.
 * No synthetic or placeholder values; empty samples surface as null / 0 with clear labels in UI.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const DEFAULT_TZ =
  process.env.INSIGHTS_TIMEZONE?.trim() || "America/New_York";

export type OrgInsightSummary = {
  /** All assignments except cancelled (basis for most metrics) */
  totalAssignments: number;
  assignmentsActive: number;
  assignmentsOverdue: number;
  assignmentsCompletedStatus: number;
  assignmentsNotStarted: number;
  uniqueEmployeesAssigned: number;
  employeesWithActiveOrOverdue: number;
  distinctPlansDeployed: number;
  stepCompletionsInPeriod: number;
  distinctEmployeesCompletingInPeriod: number;
  avgStepProgressActivePercent: number;
  avgStepProgressAllNonCancelledPercent: number;
  percentCompletionsWithEvidenceInPeriod: number;
  platformMixInPeriod: { web: number; slack: number; teams: number; other: number };
};

export type VelocityInsight = {
  /** Assignments created in period with ≥1 completion — hours from assign → first step */
  medianHoursToFirstStep: number | null;
  sampleStartedInPeriod: number;
  /** Assignments with ≥2 completions — hours from first step → last step (any time) */
  medianHoursBetweenFirstAndLastStep: number | null;
  sampleMultiStepEvents: number;
  /** Assignments where every plan step has a completion — hours assign → last step */
  medianHoursToFullyFinish: number | null;
  fullyFinishedCount: number;
};

export type DropOffCumulative = {
  /** Assignments whose highest completed step is ≥ n (monotonic funnel) */
  stepCounts: { step: number; count: number }[];
  biggestDropStep: number;
  biggestDropPercentage: number;
  hardStepNotes: string[];
  assignmentsWithAtLeastOneStep: number;
  maxStepTracked: number;
};

export type HeatmapHour = { hour: number; completionCount: number };

export type PerformerRow = {
  userId: string;
  name: string;
  stepProgressPercent: number;
  activeAssignments: number;
  stepsCompletedInPeriod: number;
};

export type PerformerInsight = {
  ranked: PerformerRow[];
  orgAverageStepProgressPercent: number;
};

export type PlanEffectivenessRow = {
  planId: string;
  title: string;
  titleShort: string;
  contentType: string;
  assignmentsTotal: number;
  assignmentsCompletedStatus: number;
  avgStepProgressPercent: number;
};

export type CategoryEngagementRow = {
  category: string;
  avgCompletionRate: number;
  totalAssignments: number;
  completedAssignments: number;
};

export type OrgInsightsBundle = {
  summary: OrgInsightSummary;
  velocity: VelocityInsight;
  dropOff: DropOffCumulative;
  heatmap: HeatmapHour[];
  performers: PerformerInsight;
  effectiveness: PlanEffectivenessRow[];
  categories: CategoryEngagementRow[];
  timeZone: string;
  timeZoneLabel: string;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const v =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(v * 10) / 10;
}

function hoursBetween(isoA: string, isoB: string): number {
  return (new Date(isoB).getTime() - new Date(isoA).getTime()) / (1000 * 60 * 60);
}

function hourInTimeZone(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value;
  return h != null ? Number.parseInt(h, 10) : 0;
}

function hasMeaningfulEvidence(ev: Json | null | undefined): boolean {
  if (ev == null) return false;
  if (typeof ev !== "object" || Array.isArray(ev)) return false;
  return Object.keys(ev as object).length > 0;
}

function shortTitle(title: string, max = 48): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function fetchAllCompletionsForAssignments(
  sb: ReturnType<typeof createAdminClient>,
  assignmentIds: string[],
): Promise<
  {
    assignment_id: string;
    step_number: number;
    completed_at: string;
    platform_completed_on: string | null;
    evidence: Json | null;
    difficulty_rating: number | null;
    note: string | null;
  }[]
> {
  if (assignmentIds.length === 0) return [];
  const chunk = 120;
  const out: {
    assignment_id: string;
    step_number: number;
    completed_at: string;
    platform_completed_on: string | null;
    evidence: Json | null;
    difficulty_rating: number | null;
    note: string | null;
  }[] = [];
  for (let i = 0; i < assignmentIds.length; i += chunk) {
    const slice = assignmentIds.slice(i, i + chunk);
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await sb
        .from("step_completions")
        .select(
          "assignment_id, step_number, completed_at, platform_completed_on, evidence, difficulty_rating, note",
        )
        .in("assignment_id", slice)
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      const batch = data ?? [];
      out.push(...batch);
      if (batch.length < pageSize) break;
    }
  }
  return out;
}

export async function computeOrgInsights(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  timeZone: string = DEFAULT_TZ,
): Promise<OrgInsightsBundle> {
  const sb = createAdminClient();
  const p0 = periodStart.toISOString();
  const p1 = periodEnd.toISOString();
  const nowIso = new Date().toISOString();

  const { data: assignments, error: aErr } = await sb
    .from("assignments")
    .select("id, plan_id, assigned_to, status, created_at, due_date")
    .eq("org_id", orgId)
    .neq("status", "cancelled");

  if (aErr) throw new Error(aErr.message);

  const rows = assignments ?? [];
  const assignmentIds = rows.map((r) => r.id);
  const planIds = [...new Set(rows.map((r) => r.plan_id))];

  const [{ data: planRows }, { data: planStepRows }, { data: contentItems }, { data: users }] =
    await Promise.all([
      planIds.length
        ? sb
            .from("plans")
            .select("id, title, category, content_item_id")
            .in("id", planIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              title: string;
              category: string | null;
              content_item_id: string | null;
            }[],
          }),
      planIds.length
        ? sb.from("plan_steps").select("plan_id, step_number").in("plan_id", planIds)
        : Promise.resolve({ data: [] as { plan_id: string; step_number: number }[] }),
      sb.from("content_items").select("id, source_type").eq("org_id", orgId),
      sb.from("users").select("id, full_name, email").eq("org_id", orgId),
    ]);

  const stepSetByPlan = new Map<string, Set<number>>();
  for (const s of planStepRows ?? []) {
    if (!stepSetByPlan.has(s.plan_id)) stepSetByPlan.set(s.plan_id, new Set());
    stepSetByPlan.get(s.plan_id)!.add(s.step_number);
  }
  const expectedStepsByPlan = new Map<string, number>();
  for (const pid of planIds) {
    const n = stepSetByPlan.get(pid)?.size ?? 0;
    expectedStepsByPlan.set(pid, Math.max(1, n));
  }

  const completions = await fetchAllCompletionsForAssignments(sb, assignmentIds);

  const assigneeByAssignmentId = new Map(
    rows.map((a) => [a.id, a.assigned_to] as const),
  );

  const completionsInPeriod = completions.filter(
    (c) => c.completed_at >= p0 && c.completed_at <= p1,
  );

  const byAssignment = new Map<string, typeof completions>();
  for (const c of completions) {
    if (!byAssignment.has(c.assignment_id)) byAssignment.set(c.assignment_id, []);
    byAssignment.get(c.assignment_id)!.push(c);
  }

  for (const [, list] of byAssignment) {
    list.sort(
      (a, b) =>
        new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime(),
    );
  }

  const maxStepDone = new Map<string, number>();
  const distinctSteps = new Map<string, Set<number>>();
  for (const c of completions) {
    const cur = maxStepDone.get(c.assignment_id) ?? 0;
    if (c.step_number > cur) maxStepDone.set(c.assignment_id, c.step_number);
    if (!distinctSteps.has(c.assignment_id)) distinctSteps.set(c.assignment_id, new Set());
    distinctSteps.get(c.assignment_id)!.add(c.step_number);
  }

  let assignmentsActive = 0;
  let assignmentsOverdue = 0;
  let assignmentsCompletedStatus = 0;
  let assignmentsNotStarted = 0;
  const assignedEmployees = new Set<string>();
  const employeesActiveOrOverdue = new Set<string>();

  for (const a of rows) {
    assignedEmployees.add(a.assigned_to);
    const hasStart = distinctSteps.has(a.id) && (distinctSteps.get(a.id)!.size > 0);
    if (a.status === "active") {
      assignmentsActive++;
      if (a.due_date && a.due_date < nowIso) assignmentsOverdue++;
      employeesActiveOrOverdue.add(a.assigned_to);
    }
    if (a.status === "completed") assignmentsCompletedStatus++;
    if (!hasStart && a.status !== "completed" && a.status !== "cancelled") {
      assignmentsNotStarted++;
    }
  }

  const progressPercentsActive: number[] = [];
  const progressPercentsAll: number[] = [];

  for (const a of rows) {
    const expected = Math.max(1, expectedStepsByPlan.get(a.plan_id) ?? 1);
    const done = distinctSteps.get(a.id)?.size ?? 0;
    const pct = Math.min(100, Math.round((done / expected) * 100));
    progressPercentsAll.push(pct);
    if (a.status === "active" || a.status === "overdue") {
      progressPercentsActive.push(pct);
    }
  }

  const avgStepProgressActivePercent =
    progressPercentsActive.length > 0
      ? Math.round(
          progressPercentsActive.reduce((s, x) => s + x, 0) /
            progressPercentsActive.length,
        )
      : 0;

  const avgStepProgressAllNonCancelledPercent =
    progressPercentsAll.length > 0
      ? Math.round(
          progressPercentsAll.reduce((s, x) => s + x, 0) / progressPercentsAll.length,
        )
      : 0;

  let withEvidence = 0;
  const platformMixInPeriod = { web: 0, slack: 0, teams: 0, other: 0 };
  const completingEmployeesInPeriod = new Set<string>();

  for (const c of completionsInPeriod) {
    if (hasMeaningfulEvidence(c.evidence as Json)) withEvidence++;
    const p = (c.platform_completed_on ?? "").toLowerCase();
    if (p === "web") platformMixInPeriod.web++;
    else if (p === "slack") platformMixInPeriod.slack++;
    else if (p === "teams") platformMixInPeriod.teams++;
    else platformMixInPeriod.other++;
    const uid = assigneeByAssignmentId.get(c.assignment_id);
    if (uid) completingEmployeesInPeriod.add(uid);
  }

  const percentCompletionsWithEvidenceInPeriod =
    completionsInPeriod.length > 0
      ? Math.round((withEvidence / completionsInPeriod.length) * 100)
      : 0;

  const summary: OrgInsightSummary = {
    totalAssignments: rows.length,
    assignmentsActive,
    assignmentsOverdue,
    assignmentsCompletedStatus,
    assignmentsNotStarted,
    uniqueEmployeesAssigned: assignedEmployees.size,
    employeesWithActiveOrOverdue: employeesActiveOrOverdue.size,
    distinctPlansDeployed: new Set(rows.map((r) => r.plan_id)).size,
    stepCompletionsInPeriod: completionsInPeriod.length,
    distinctEmployeesCompletingInPeriod: completingEmployeesInPeriod.size,
    avgStepProgressActivePercent,
    avgStepProgressAllNonCancelledPercent,
    percentCompletionsWithEvidenceInPeriod,
    platformMixInPeriod,
  };

  /* --- Velocity (only real durations, no status=completed-only filter) --- */
  const timesToFirstInPeriod: number[] = [];
  for (const a of rows) {
    if (a.created_at < p0 || a.created_at > p1) continue;
    const list = byAssignment.get(a.id);
    if (!list?.length) continue;
    timesToFirstInPeriod.push(hoursBetween(a.created_at, list[0]!.completed_at));
  }

  const timesBetweenFirstLast: number[] = [];
  const timesFullFinish: number[] = [];
  for (const a of rows) {
    const list = byAssignment.get(a.id);
    if (!list || list.length < 2) continue;
    timesBetweenFirstLast.push(
      hoursBetween(list[0]!.completed_at, list[list.length - 1]!.completed_at),
    );
    const expected = expectedStepsByPlan.get(a.plan_id) ?? 0;
    const doneSet = distinctSteps.get(a.id);
    if (expected > 0 && doneSet && doneSet.size >= expected) {
      timesFullFinish.push(
        hoursBetween(a.created_at, list[list.length - 1]!.completed_at),
      );
    }
  }

  const velocity: VelocityInsight = {
    medianHoursToFirstStep: median(timesToFirstInPeriod),
    sampleStartedInPeriod: timesToFirstInPeriod.length,
    medianHoursBetweenFirstAndLastStep: median(timesBetweenFirstLast),
    sampleMultiStepEvents: timesBetweenFirstLast.length,
    medianHoursToFullyFinish: median(timesFullFinish),
    fullyFinishedCount: timesFullFinish.length,
  };

  /* --- Cumulative funnel: assignments where max completed step ≥ n --- */
  let globalMaxStep = 1;
  for (const a of rows) {
    const exp = expectedStepsByPlan.get(a.plan_id) ?? 0;
    if (exp > globalMaxStep) globalMaxStep = exp;
  }
  for (const m of maxStepDone.values()) {
    if (m > globalMaxStep) globalMaxStep = m;
  }
  globalMaxStep = Math.max(1, globalMaxStep);

  const startedAssignments = rows.filter(
    (a) => (maxStepDone.get(a.id) ?? 0) >= 1,
  );
  const stepCounts: { step: number; count: number }[] = [];
  for (let n = 1; n <= globalMaxStep; n++) {
    const count = startedAssignments.filter(
      (a) => (maxStepDone.get(a.id) ?? 0) >= n,
    ).length;
    stepCounts.push({ step: n, count });
  }

  let biggestDropStep = 0;
  let biggestDropPct = 0;
  for (let i = 1; i < stepCounts.length; i++) {
    const prev = stepCounts[i - 1]!.count;
    const curr = stepCounts[i]!.count;
    if (prev > 0) {
      const drop = ((prev - curr) / prev) * 100;
      if (drop > biggestDropPct) {
        biggestDropPct = drop;
        biggestDropStep = stepCounts[i]!.step;
      }
    }
  }

  const hardStepNotes = completions
    .filter(
      (c) =>
        c.step_number === biggestDropStep &&
        c.difficulty_rating != null &&
        c.difficulty_rating >= 4 &&
        c.note?.trim(),
    )
    .map((c) => c.note!.trim())
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .slice(0, 5);

  const dropOff: DropOffCumulative = {
    stepCounts,
    biggestDropStep,
    biggestDropPercentage: Math.round(biggestDropPct),
    hardStepNotes,
    assignmentsWithAtLeastOneStep: startedAssignments.length,
    maxStepTracked: globalMaxStep,
  };

  /* --- Heatmap (timezone) --- */
  const hourCounts = new Array(24).fill(0);
  for (const c of completionsInPeriod) {
    const h = hourInTimeZone(c.completed_at, timeZone);
    if (h >= 0 && h < 24) hourCounts[h]++;
  }
  const heatmap: HeatmapHour[] = hourCounts.map((completionCount, hour) => ({
    hour,
    completionCount,
  }));

  /* --- Performers: step progress on active+overdue per employee --- */
  const byUser = new Map<
    string,
    { sum: number; n: number; stepsInPeriod: number }
  >();
  for (const a of rows) {
    if (a.status !== "active" && a.status !== "overdue") continue;
    const expected = Math.max(1, expectedStepsByPlan.get(a.plan_id) ?? 1);
    const done = distinctSteps.get(a.id)?.size ?? 0;
    const pct = Math.min(100, Math.round((done / expected) * 100));
    if (!byUser.has(a.assigned_to)) {
      byUser.set(a.assigned_to, { sum: 0, n: 0, stepsInPeriod: 0 });
    }
    const u = byUser.get(a.assigned_to)!;
    u.sum += pct;
    u.n++;
  }

  for (const c of completionsInPeriod) {
    const uid = assigneeByAssignmentId.get(c.assignment_id);
    if (!uid) continue;
    if (!byUser.has(uid)) {
      byUser.set(uid, { sum: 0, n: 0, stepsInPeriod: 0 });
    }
    byUser.get(uid)!.stepsInPeriod++;
  }

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.full_name?.trim() || u.email.split("@")[0] || "Member");
  }

  const ranked: PerformerRow[] = [...byUser.entries()]
    .map(([userId, v]) => ({
      userId,
      name: nameMap.get(userId) ?? "Unknown",
      stepProgressPercent: v.n > 0 ? Math.round(v.sum / v.n) : 0,
      activeAssignments: v.n,
      stepsCompletedInPeriod: v.stepsInPeriod,
    }))
    .sort((a, b) => b.stepProgressPercent - a.stepProgressPercent);

  const orgAverageStepProgressPercent =
    ranked.length > 0
      ? Math.round(
          ranked.reduce((s, r) => s + r.stepProgressPercent, 0) / ranked.length,
        )
      : 0;

  const performers: PerformerInsight = {
    ranked,
    orgAverageStepProgressPercent,
  };

  /* --- Plan effectiveness --- */
  const contentTypeMap = new Map<string, string>();
  for (const c of contentItems ?? []) {
    contentTypeMap.set(c.id, c.source_type);
  }

  const planTitleMap = new Map<string, string>();
  const planContentMap = new Map<string, string | null>();
  for (const p of planRows ?? []) {
    planTitleMap.set(p.id, p.title);
    planContentMap.set(p.id, p.content_item_id);
  }

  const aggPlan = new Map<
    string,
    { total: number; completed: number; progressSum: number }
  >();
  for (const a of rows) {
    if (!aggPlan.has(a.plan_id)) {
      aggPlan.set(a.plan_id, { total: 0, completed: 0, progressSum: 0 });
    }
    const g = aggPlan.get(a.plan_id)!;
    g.total++;
    if (a.status === "completed") g.completed++;
    const expected = Math.max(1, expectedStepsByPlan.get(a.plan_id) ?? 1);
    const done = distinctSteps.get(a.id)?.size ?? 0;
    g.progressSum += Math.min(100, Math.round((done / expected) * 100));
  }

  const effectiveness: PlanEffectivenessRow[] = [...aggPlan.entries()]
    .map(([planId, g]) => {
      const title = planTitleMap.get(planId) ?? "Plan";
      const cid = planContentMap.get(planId);
      return {
        planId,
        title,
        titleShort: shortTitle(title, 44),
        contentType: cid ? contentTypeMap.get(cid) ?? "unknown" : "—",
        assignmentsTotal: g.total,
        assignmentsCompletedStatus: g.completed,
        avgStepProgressPercent:
          g.total > 0 ? Math.round(g.progressSum / g.total) : 0,
      };
    })
    .sort((a, b) => b.assignmentsTotal - a.assignmentsTotal);

  /* --- Categories --- */
  const planCategoryMap = new Map<string, string>();
  for (const p of planRows ?? []) {
    planCategoryMap.set(p.id, p.category?.trim() || "Uncategorized");
  }

  const catStats = new Map<string, { total: number; completed: number }>();
  for (const a of rows) {
    if (a.created_at < p0 || a.created_at > p1) continue;
    const cat = planCategoryMap.get(a.plan_id) ?? "Uncategorized";
    if (!catStats.has(cat)) catStats.set(cat, { total: 0, completed: 0 });
    const s = catStats.get(cat)!;
    s.total++;
    if (a.status === "completed") s.completed++;
  }

  const categories: CategoryEngagementRow[] = [...catStats.entries()].map(
    ([category, s]) => ({
      category,
      avgCompletionRate:
        s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      totalAssignments: s.total,
      completedAssignments: s.completed,
    }),
  );

  return {
    summary,
    velocity,
    dropOff,
    heatmap,
    performers,
    effectiveness,
    categories,
    timeZone,
    timeZoneLabel: timeZone.replace(/_/g, " "),
  };
}
