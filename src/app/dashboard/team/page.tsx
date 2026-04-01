import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, UserPlus, LineChart } from "lucide-react";

import { PageHeader } from "@/components/design/page-header";
import { completionInDateRange } from "@/lib/dashboard/activity-filter";
import { createClient } from "@/lib/supabase/server";

import {
  TeamPerformanceClient,
  type TeamPerfRow,
} from "./team-performance-client";
import { TeamInviteForm } from "./team-invite-form";
import { BulkInvitePanel } from "@/components/dashboard/bulk-invite-panel";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const from = sp.from?.trim() || undefined;
  const to = sp.to?.trim() || undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me, error: meErr } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (meErr || !me?.org_id) {
    redirect("/dashboard");
  }

  if (me.role !== "admin" && me.role !== "super_admin") {
    redirect("/employee");
  }

  const orgId = me.org_id;

  const [{ data: members }, { data: pendingInvites }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, role, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("email, status, created_at")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const memberEmails = new Set(
    (members ?? []).map((m) => m.email.toLowerCase()),
  );

  const pendingRows = (pendingInvites ?? []).filter(
    (p) => !memberEmails.has(p.email.toLowerCase()),
  );

  const { data: employees } = await supabase
    .from("users")
    .select("id, full_name, email, title")
    .eq("org_id", orgId)
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, assigned_to, plan_id, status")
    .eq("org_id", orgId)
    .neq("status", "cancelled");

  const planIds = [...new Set((assignments ?? []).map((a) => a.plan_id))];
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

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const countByAssignment = new Map<string, number>();
  const lastByAssignment = new Map<string, string>();

  if (assignmentIds.length > 0) {
    const { data: completions } = await supabase
      .from("step_completions")
      .select("assignment_id, completed_at")
      .in("assignment_id", assignmentIds);

    for (const c of completions ?? []) {
      countByAssignment.set(
        c.assignment_id,
        (countByAssignment.get(c.assignment_id) ?? 0) + 1,
      );
      const prev = lastByAssignment.get(c.assignment_id);
      if (!prev || c.completed_at > prev) {
        lastByAssignment.set(c.assignment_id, c.completed_at);
      }
    }
  }

  const perfRowsAll: TeamPerfRow[] = (employees ?? []).map((e) => {
    const theirs = (assignments ?? []).filter((a) => a.assigned_to === e.id);
    const activeAssignments = theirs.filter((a) => a.status === "active").length;
    let expectedSteps = 0;
    let completedSteps = 0;
    let lastActivityIso: string | null = null;
    for (const a of theirs) {
      expectedSteps += nByPlan.get(a.plan_id) ?? 0;
      completedSteps += countByAssignment.get(a.id) ?? 0;
      const la = lastByAssignment.get(a.id);
      if (la && (!lastActivityIso || la > lastActivityIso)) {
        lastActivityIso = la;
      }
    }
    return {
      userId: e.id,
      name: e.full_name?.trim() || e.email,
      title: e.title,
      activeAssignments,
      completedSteps,
      expectedSteps,
      lastActivityIso,
    };
  });

  const perfRowsFiltered =
    from || to
      ? perfRowsAll.filter((r) =>
          completionInDateRange(r.lastActivityIso, from, to),
        )
      : perfRowsAll;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Team"
        subtitle="Invite employees, review roster, and inspect training progress with evidence."
      />

      <div className="rounded-2xl border border-border bg-card shadow-none">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary">
            <UserPlus className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Invite an employee
            </h2>
            <p className="text-xs text-muted-foreground">
              Employees get access to training plans. They cannot create an org or upload content.
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <TeamInviteForm />
        </div>
        <div className="border-t border-border px-6 py-5">
          <BulkInvitePanel />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-none">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary">
            <LineChart className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Training performance
            </h2>
            <p className="text-xs text-muted-foreground">
              Completion rates use each plan&apos;s step count (not a fixed number). Filter by last activity date.
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <TeamPerformanceClient rows={perfRowsFiltered} from={from} to={to} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-none">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary">
            <Users className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Team members</h2>
            <p className="text-xs text-muted-foreground">
              People in your workspace and invitations still pending.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto px-6 py-4">
          {(members ?? []).length === 0 && pendingRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No team members yet. Send an invite above.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Email</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {(members ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      {m.role === "employee" ? (
                        <Link
                          href={`/dashboard/team/${m.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {m.full_name?.trim() || "—"}
                        </Link>
                      ) : (
                        m.full_name?.trim() || "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">{m.email}</td>
                    <td className="py-3 pr-4 capitalize">{m.role.replace("_", " ")}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
                {pendingRows.map((p) => (
                  <tr key={`inv-${p.email}`} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground">—</td>
                    <td className="py-3 pr-4">{p.email}</td>
                    <td className="py-3 pr-4">Employee</td>
                    <td className="py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground/70">
                        Invite pending
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
