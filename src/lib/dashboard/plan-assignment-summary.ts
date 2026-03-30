import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

export type PlanAssignmentStats = {
  total: number;
  groupNames: Set<string>;
  individualCount: number;
};

export function aggregateAssignmentsByPlan(
  rows: {
    plan_id: string;
    group_id: string | null;
    groups: unknown;
  }[],
): Map<string, PlanAssignmentStats> {
  const map = new Map<string, PlanAssignmentStats>();
  for (const ar of rows) {
    const cur = map.get(ar.plan_id) ?? {
      total: 0,
      groupNames: new Set<string>(),
      individualCount: 0,
    };
    cur.total += 1;
    const g = unwrapRelation(
      ar.groups as unknown as { name: string } | { name: string }[] | null,
    );
    if (ar.group_id) {
      cur.groupNames.add(g?.name?.trim() || "Group");
    } else {
      cur.individualCount += 1;
    }
    map.set(ar.plan_id, cur);
  }
  return map;
}

/** One-line summary for plans list rows. */
export function formatPlanAssignmentSummary(stats: PlanAssignmentStats | undefined): {
  line: string;
  hasAssignments: boolean;
} {
  if (!stats || stats.total === 0) {
    return { line: "No assignments yet", hasAssignments: false };
  }
  const parts: string[] = [
    `${stats.total} assignment${stats.total === 1 ? "" : "s"}`,
  ];
  if (stats.groupNames.size > 0) {
    parts.push(`Groups: ${[...stats.groupNames].sort().join(", ")}`);
  }
  if (stats.individualCount > 0) {
    parts.push(
      stats.groupNames.size > 0 ? "Individual assignees" : "Individual",
    );
  }
  return { line: parts.join(" · "), hasAssignments: true };
}
