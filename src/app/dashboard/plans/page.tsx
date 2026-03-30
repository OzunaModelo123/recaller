import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  aggregateAssignmentsByPlan,
  formatPlanAssignmentSummary,
} from "@/lib/dashboard/plan-assignment-summary";
import { createClient } from "@/lib/supabase/server";

export default async function PlansListPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    redirect("/dashboard");
  }

  const orgId = profile.org_id;

  const [{ data: plans }, { data: assignRows }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, title, target_role, created_at, complexity")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("plan_id, group_id, groups(name)")
      .eq("org_id", orgId)
      .neq("status", "cancelled"),
  ]);

  const statsByPlan = aggregateAssignmentsByPlan(assignRows ?? []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Plans
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          AI-generated learning plans from your content library. Assignment coverage
          and groups update when you distribute from each plan or Assignments.
        </p>
      </div>

      {!plans?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No plans yet. Open a ready content item and choose{" "}
          <span className="font-medium text-muted-foreground">Generate plan</span>.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-none">
          {plans.map((p) => {
            const { line, hasAssignments } = formatPlanAssignmentSummary(
              statsByPlan.get(p.id),
            );
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-secondary/80 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">{p.title}</p>
                      {hasAssignments ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-primary/25 bg-primary/8 text-[11px] font-medium text-primary"
                        >
                          Assigned
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[11px] font-medium"
                        >
                          Not assigned
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.target_role ? `${p.target_role} · ` : ""}
                      {p.complexity ?? "—"} ·{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {line}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <span className="text-xs font-medium text-primary sm:hidden">
                      Open
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
