import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/design/empty-state";
import { PageHeader } from "@/components/design/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchEmployeeAssignmentSummaries } from "@/lib/employee/assignment-summaries";
import { getEmployeeSessionProfile } from "@/lib/employee/session-profile";
import { createClient } from "@/lib/supabase/server";

export default async function MyPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getEmployeeSessionProfile(user.id);
  const sorted = await fetchEmployeeAssignmentSummaries(supabase, user.id);

  return (
    <div className="space-y-8">
      <div className="space-y-4 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {profile?.orgName ?? "Training"}
        </p>
        <PageHeader
          title="My Plans"
          subtitle="Every plan is broken into clear steps. Open one to follow instructions, submit proof, and track your progress."
          action={
            sorted.length === 0 ? (
              <Link
                href="/employee"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Home
              </Link>
            ) : null
          }
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No plans assigned yet"
          description="Your manager or admin assigns training here. Check back later, or visit the home tab for an overview when new plans arrive."
          cta={{ label: "Back to home", href: "/employee" }}
        />
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {sorted.map((r) => (
            <li key={r.id}>
              <Link href={`/employee/my-plans/${r.id}`} className="block">
                <Card className="transition-colors hover:border-border hover:bg-secondary/80">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">{r.title}</p>
                        {r.due && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {new Date(r.due).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}
                          </p>
                        )}
                      </div>
                      <Badge variant={r.variant} className="shrink-0">
                        {r.label}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-medium text-muted-foreground">
                        <span>
                          {r.done} / {r.total} steps
                        </span>
                        <span className="tabular-nums">
                          {r.total > 0 ? Math.round((r.done / r.total) * 100) : 0}%
                        </span>
                      </div>
                      <Progress
                        value={r.total > 0 ? (r.done / r.total) * 100 : 0}
                        className="h-1.5"
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
