import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assignmentStatusMeta,
  pickNextAssignment,
  type EmployeeAssignmentSummary,
} from "@/lib/employee/assignment-summaries";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";
import type { Database } from "@/types/database";

export type PlanAssignCandidate = {
  userId: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  currentTask: string;
};

function formatRole(role: string): string {
  return role.replace(/_/g, " ");
}

export async function fetchPlanAssignCandidates(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<PlanAssignCandidate[]> {
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, role, title")
    .eq("org_id", orgId)
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  const list = users ?? [];
  if (list.length === 0) return [];

  const empIds = list.map((u) => u.id);

  const { data: rawAssigns } = await supabase
    .from("assignments")
    .select("id, assigned_to, plan_id, status, due_date, created_at, plans(title)")
    .eq("org_id", orgId)
    .in("assigned_to", empIds)
    .neq("status", "cancelled");

  const assigns = rawAssigns ?? [];
  const planIds = [...new Set(assigns.map((a) => a.plan_id))];

  const nByPlan = new Map<string, number>();
  if (planIds.length > 0) {
    const { data: stepRows } = await supabase
      .from("plan_steps")
      .select("plan_id")
      .in("plan_id", planIds);
    for (const s of stepRows ?? []) {
      nByPlan.set(s.plan_id, (nByPlan.get(s.plan_id) ?? 0) + 1);
    }
  }

  const assignIds = assigns.map((a) => a.id);
  const doneByAssign = new Map<string, number>();
  if (assignIds.length > 0) {
    const { data: compRows } = await supabase
      .from("step_completions")
      .select("assignment_id")
      .in("assignment_id", assignIds);
    for (const c of compRows ?? []) {
      doneByAssign.set(
        c.assignment_id,
        (doneByAssign.get(c.assignment_id) ?? 0) + 1,
      );
    }
  }

  const byUser = new Map<string, typeof assigns>();
  for (const a of assigns) {
    const arr = byUser.get(a.assigned_to) ?? [];
    arr.push(a);
    byUser.set(a.assigned_to, arr);
  }

  const nowMs = Date.now();

  function summariesForUser(uid: string): EmployeeAssignmentSummary[] {
    const rows = byUser.get(uid) ?? [];
    const mapped = rows.map((a) => {
      const plan = unwrapRelation(
        a.plans as unknown as { title: string } | { title: string }[] | null,
      );
      const title = plan?.title ?? "Plan";
      const n = nByPlan.get(a.plan_id) ?? 0;
      const d = doneByAssign.get(a.id) ?? 0;
      const due = a.due_date ? new Date(a.due_date) : null;
      const overdue =
        a.status === "active" &&
        Boolean(due && due.getTime() < nowMs && d < n);
      const { label, variant } = assignmentStatusMeta(d, n, a.status, overdue);
      return {
        id: a.id,
        title,
        done: d,
        total: n,
        due: a.due_date,
        label,
        variant,
        assignerNote: null,
      };
    });
    return [...mapped].sort((a, b) => {
      const ac = a.label === "Completed" ? 1 : 0;
      const bc = b.label === "Completed" ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return 0;
    });
  }

  return list.map((u) => {
    const summaries = summariesForUser(u.id);
    const next = pickNextAssignment(summaries);
    let currentTask: string;
    if (summaries.length === 0) {
      currentTask = "No assignments yet";
    } else if (next) {
      const stepHint =
        next.total > 0 && next.done < next.total
          ? ` · Step ${next.done + 1} of ${next.total}`
          : "";
      currentTask = `${next.title} · ${next.label}${stepHint}`;
    } else {
      currentTask = "All assigned plans completed";
    }

    return {
      userId: u.id,
      name: u.full_name?.trim() || u.email,
      email: u.email,
      role: formatRole(u.role),
      title: u.title,
      currentTask,
    };
  });
}
