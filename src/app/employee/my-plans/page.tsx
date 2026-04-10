import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/design/empty-state";
import { PageHeader } from "@/components/design/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmployeeSlackConnectPanel } from "@/components/employee/slack-connect-panel";
import { fetchEmployeeAssignmentSummaries } from "@/lib/employee/assignment-summaries";
import { getEmployeeSessionProfile } from "@/lib/employee/session-profile";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ slack?: string; reason?: string }> };

export default async function MyPlansPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getEmployeeSessionProfile(user.id, user.email);
  const sorted = await fetchEmployeeAssignmentSummaries(supabase, user.id);

  const { data: slackState } = await supabase
    .from("users")
    .select("role, slack_employee_linked_at, organisations ( slack_team_id )")
    .eq("id", user.id)
    .maybeSingle();

  const orgSlack =
    slackState?.organisations &&
    typeof slackState.organisations === "object" &&
    "slack_team_id" in slackState.organisations
      ? (slackState.organisations as { slack_team_id: string | null }).slack_team_id
      : null;

  const showEmployeeSlackConnect =
    slackState &&
    !["admin", "super_admin"].includes(slackState.role) &&
    !!orgSlack &&
    slackState.slack_employee_linked_at == null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="My plans"
        subtitle={`${profile?.orgName ?? "Your workspace"} · Every plan is broken into clear steps. Open one to follow instructions, submit proof, and track progress. Slack and Teams live under Integrations.`}
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/employee"
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/employee/profile"
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Profile
            </Link>
            <Link
              href="/employee/integrations"
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Integrations
            </Link>
          </div>
        }
      />

      {showEmployeeSlackConnect ? (
        <EmployeeSlackConnectPanel
          slackResult={params.slack ?? null}
          slackReason={params.reason ?? null}
        />
      ) : null}

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
                <Card className="border-border/90 shadow-[var(--shadow-card)] transition-colors hover:border-primary/20 hover:shadow-[var(--shadow-card-hover)]">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">{r.title}</p>
                        {r.assignerNote?.trim() ? (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                            <span className="font-medium text-foreground/80">Note: </span>
                            {r.assignerNote.trim()}
                          </p>
                        ) : null}
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
