import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, FileText, Calendar, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadInsightReports, loadLiveAnalytics } from "@/lib/dashboard/load-insights";
import { InsightsCharts } from "@/components/dashboard/insights-charts";

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

  const hasData =
    analytics.velocity.totalCompleted > 0 ||
    analytics.dropOff.stepCounts.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Insights
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            AI-powered analytics and reports on team training performance.
            <span className="ml-2 text-xs text-muted-foreground/70">
              {analytics.periodLabel}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Overview
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" asChild>
            <Link href="/dashboard/assignments">
              <ClipboardList className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Assignments
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" asChild>
            <Link href="/dashboard/team">
              <Users className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Team
            </Link>
          </Button>
        </div>
      </div>

      {hasData ? (
        <InsightsCharts
          velocity={analytics.velocity}
          dropOff={analytics.dropOff}
          heatmap={analytics.heatmap}
          performers={analytics.performers}
          effectiveness={analytics.effectiveness}
          periodLabel={analytics.periodLabel}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-16 text-center">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="mt-5 text-sm font-semibold text-foreground">
            Not enough data yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Assign training plans and collect completions. Analytics will appear
            once employees start completing steps.
          </p>
        </div>
      )}

      {reports.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Generated Reports
          </h2>
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {report.report_type === "monthly"
                        ? "Monthly Insight Report"
                        : report.report_type}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(report.period_start).toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric" },
                      )}{" "}
                      –{" "}
                      {new Date(report.period_end).toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric" },
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.generated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
