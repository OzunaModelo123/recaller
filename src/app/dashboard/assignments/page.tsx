import { redirect } from "next/navigation";

import { PageHeader } from "@/components/design/page-header";
import { createClient } from "@/lib/supabase/server";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

import { AssignmentsTable, type AssignmentRow } from "./assignments-table";
import { GroupsPanel } from "./groups-panel";
import { NewAssignmentSheet } from "./new-assignment-sheet";

function fmtUser(
  row: { full_name: string | null; email: string } | null | undefined,
): string {
  if (!row) return "—";
  return row.full_name?.trim() || row.email;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!me?.org_id) redirect("/dashboard");
  if (me.role !== "admin" && me.role !== "super_admin") redirect("/employee");

  const orgId = me.org_id;

  const [
    { data: plans },
    { data: employees },
    { data: groupsRaw },
    { data: assignmentsRaw },
  ] = await Promise.all([
    supabase
      .from("plans")
      .select("id, title")
      .eq("org_id", orgId)
      .order("title", { ascending: true }),
    supabase
      .from("users")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .eq("role", "employee")
      .order("full_name", { ascending: true }),
    supabase
      .from("groups")
      .select("id, name")
      .eq("org_id", orgId)
      .order("name", { ascending: true }),
    supabase
      .from("assignments")
      .select(
        `
        id,
        status,
        due_date,
        scheduled_for,
        created_at,
        plans ( title ),
        assignee:users!assignments_assigned_to_fkey ( full_name, email ),
        assigner:users!assignments_assigned_by_fkey ( full_name, email )
      `,
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const groupIds = (groupsRaw ?? []).map((g) => g.id);
  const membersByGroup = new Map<string, { userId: string; label: string }[]>();
  if (groupIds.length > 0) {
    const { data: gm } = await supabase
      .from("group_members")
      .select("group_id, user_id, users(full_name, email)")
      .in("group_id", groupIds);
    for (const row of gm ?? []) {
      const userRow = unwrapRelation(
        row.users as unknown as
          | { full_name: string | null; email: string }
          | { full_name: string | null; email: string }[]
          | null,
      );
      const label = fmtUser(userRow);
      const list = membersByGroup.get(row.group_id) ?? [];
      list.push({ userId: row.user_id, label });
      membersByGroup.set(row.group_id, list);
    }
  }

  const groupsForPanel = (groupsRaw ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    members: membersByGroup.get(g.id) ?? [],
  }));

  const employeeOpts = (employees ?? []).map((e) => ({
    id: e.id,
    label: e.full_name?.trim() || e.email,
  }));

  const assignmentRows: AssignmentRow[] = (assignmentsRaw ?? []).map((a) => {
    const plan = unwrapRelation(
      a.plans as unknown as { title: string } | { title: string }[] | null,
    );
    const assignee = unwrapRelation(
      a.assignee as unknown as
        | { full_name: string | null; email: string }
        | { full_name: string | null; email: string }[]
        | null,
    );
    const assigner = unwrapRelation(
      a.assigner as unknown as
        | { full_name: string | null; email: string }
        | { full_name: string | null; email: string }[]
        | null,
    );
    return {
      id: a.id,
      planTitle: plan?.title ?? "—",
      assigneeLabel: fmtUser(assignee),
      assignerLabel: fmtUser(assigner),
      status: a.status,
      dueLabel: fmtDate(a.due_date),
      createdLabel: fmtDate(a.created_at),
    };
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Assignments"
        subtitle="Create assignments, manage groups, and track distribution across your org."
        action={
          <NewAssignmentSheet
            plans={plans ?? []}
            employees={employees ?? []}
            groups={groupsRaw ?? []}
          />
        }
      />

      <section className="space-y-5" aria-labelledby="assignments-table-heading">
        <h2 id="assignments-table-heading" className="sr-only">
          All assignments
        </h2>
        <AssignmentsTable rows={assignmentRows} />
      </section>

      <section aria-labelledby="groups-heading">
        <h2 id="groups-heading" className="sr-only">
          Groups
        </h2>
        <GroupsPanel groups={groupsForPanel} employees={employeeOpts} />
      </section>
    </div>
  );
}
