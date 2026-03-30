import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/server";

function statusLabel(
  done: number,
  total: number,
  assignmentStatus: string,
  overdue: boolean,
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
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

export default async function MyPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Compute "now" once per request for overdue comparisons.
  const nowMs = new Date().getTime();

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
    .eq("assigned_to", user.id)
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
        a.status === "active" &&
        Boolean(due && due.getTime() < nowMs && d < n);

      const { label, variant } = statusLabel(
        d,
        n,
        a.status,
        overdue,
      );

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

  const sorted = [...rows].sort((a, b) => {
    const ac = a.label === "Completed" ? 1 : 0;
    const bc = b.label === "Completed" ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return 0;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">My Plans</h1>
        <p className="mt-1 text-sm text-stone-400">
          Assigned training plans and your progress.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
          <h3 className="text-sm font-semibold text-stone-700">No plans assigned yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-400">
            When your admin assigns a plan to you, it will appear here with step-by-step
            instructions and proof you can submit in Recaller.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {sorted.map((r) => (
            <li key={r.id}>
              <Link href={`/employee/my-plans/${r.id}`}>
                <Card className="border-stone-200 transition-colors hover:border-stone-300 hover:bg-stone-50/50">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-stone-900">{r.title}</p>
                        {r.due && (
                          <p className="mt-1 text-xs text-stone-500">
                            Due {new Date(r.due).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Badge variant={r.variant}>{r.label}</Badge>
                    </div>
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-xs text-stone-500">
                        <span>
                          {r.done} / {r.total} steps
                        </span>
                      </div>
                      <Progress
                        value={r.total > 0 ? (r.done / r.total) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
