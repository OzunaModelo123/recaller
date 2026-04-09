import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ClipboardList, FileVideo } from "lucide-react";

import { PageHeader } from "@/components/design/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        title="Plans"
        subtitle="AI-generated learning plans from your content library. Assignment coverage and groups update when you distribute from each plan or Assignments."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3" asChild>
              <Link href="/dashboard/content">
                <FileVideo className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Content
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3" asChild>
              <Link href="/dashboard/assignments">
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Assignments
              </Link>
            </Button>
          </div>
        }
      />

      {!plans?.length ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 py-16 text-center text-sm text-muted-foreground">
          No plans yet. Open a ready content item and choose{" "}
          <span className="font-medium text-muted-foreground">Generate plan</span>.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {plans.map((p) => {
            const { line, hasAssignments } = formatPlanAssignmentSummary(
              statsByPlan.get(p.id),
            );
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
