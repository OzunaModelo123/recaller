import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type AssignmentStatusLabel =
  | "Completed"
  | "Overdue"
  | "Not started"
  | "In progress";

export type AssignmentSummaryVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

export type EmployeeAssignmentSummary = {
  id: string;
  title: string;
  done: number;
  total: number;
  due: string | null;
  label: AssignmentStatusLabel;
  variant: AssignmentSummaryVariant;
};

export function assignmentStatusMeta(
  done: number,
  total: number,
  assignmentStatus: string,
  overdue: boolean,
): { label: AssignmentStatusLabel; variant: AssignmentSummaryVariant } {
  if (assignmentStatus === "completed" || (total > 0 && done >= total)) {
    return { label: "Completed", variant: "default" };
  }
  if (overdue) {
    return { label: "Overdue", variant: "destructive" };
  }
  if (done === 0) {
    return { label: "Not started", variant: "secondary" };
  }
  return { label: "In progress", variant: "outline" };
}

/** Active assignments: not fully completed by step count and status active. */
export function isActiveAssignment(summary: EmployeeAssignmentSummary): boolean {
  return summary.label !== "Completed";
}

export async function fetchEmployeeAssignmentSummaries(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<EmployeeAssignmentSummary[]> {
  const nowMs = Date.now();
  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      `
      id,
      due_date,
      status,
      created_at,
      plan_id,
      plans (
        title
      )
    `,
    )
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false });

  const rows = await Promise.all(
    (assignments ?? []).map(async (a) => {
      const planId = a.plan_id;
      const title =
        a.plans && typeof a.plans === "object" && "title" in a.plans
          ? String((a.plans as { title: string }).title)
          : "Plan";

      const [{ count: total }, { count: done }] = await Promise.all([
        supabase
          .from("plan_steps")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", planId),
        supabase
          .from("step_completions")
          .select("id", { count: "exact", head: true })
          .eq("assignment_id", a.id),
      ]);

      const n = total ?? 0;
      const d = done ?? 0;
      const due = a.due_date ? new Date(a.due_date) : null;
      const overdue =
        a.status === "active" && Boolean(due && due.getTime() < nowMs && d < n);

      const { label, variant } = assignmentStatusMeta(d, n, a.status, overdue);

      return {
        id: a.id,
        title,
        done: d,
        total: n,
        due: a.due_date,
        label,
        variant,
      };
    }),
  );

  return [...rows].sort((a, b) => {
    const ac = a.label === "Completed" ? 1 : 0;
    const bc = b.label === "Completed" ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return 0;
  });
}

/** Pick the best “continue here” assignment for the home hero CTA. */
export function pickNextAssignment(
  summaries: EmployeeAssignmentSummary[],
): EmployeeAssignmentSummary | null {
  const active = summaries.filter(isActiveAssignment);
  if (active.length === 0) return null;
  const overdue = active.find((s) => s.label === "Overdue");
  if (overdue) return overdue;
  const inProgress = active.find((s) => s.label === "In progress");
  if (inProgress) return inProgress;
  return active[0] ?? null;
}
