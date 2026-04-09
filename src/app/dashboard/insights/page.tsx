import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Calendar, ClipboardList, FileText, Sparkles, Users } from "lucide-react";

import { InsightsClient } from "@/components/dashboard/insights-client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadInsightReports, loadLiveAnalytics } from "@/lib/dashboard/load-insights";

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id || (profile.role !== "admin" && profile.role !== "super_admin")) {
    redirect("/dashboard");
  }

  const [reports, analytics] = await Promise.all([
    loadInsightReports(profile.org_id),
    loadLiveAnalytics(profile.org_id),
  ]);

  const hasAssignments = analytics.summary.totalAssignments > 0;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-6 shadow-[var(--shadow-card)] md:px-7 md:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,97,60,0.08),transparent_45%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Manager analytics
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Insights
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Clear, live analytics for what managers actually care about:
                progress, speed, bottlenecks, participation, and proof of work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1.5">
                Activity window: {analytics.periodLabel}
              </span>
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1.5">
                Timezone auto-detects from the viewer
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" size="sm" className="h-9 rounded-xl" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Overview
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" asChild>
              <Link href="/dashboard/assignments">
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Assignments
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" asChild>
              <Link href="/dashboard/team">
                <Users className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Team
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {hasAssignments ? (
        <InsightsClient initialAnalytics={analytics} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/60 py-16 text-center">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="mt-5 text-sm font-semibold text-foreground">
            Not enough data yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Assign training plans and collect completions. Insights will become useful
            as soon as people start working through steps.
          </p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Generated reports
              </h2>
              <p className="text-sm text-muted-foreground">
                Saved AI summaries based on the same tracked metrics shown above.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {reports.length} saved
            </span>
          </div>
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {report.report_type === "monthly"
                        ? "Monthly insight report"
                        : report.report_type}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(report.period_start).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(report.period_end).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(report.generated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
