"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Layers,
  MonitorSmartphone,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import type { LiveAnalyticsPayload } from "@/lib/dashboard/load-insights";
import { Button } from "@/components/ui/button";

function fmtHours(v: number | null): string {
  if (v == null) return "—";
  if (v < 0.1) return "< 0.1 h";
  return `${v} h`;
}

export function InsightsCharts(data: LiveAnalyticsPayload) {
  const {
    periodLabel,
    summary,
    velocity,
    dropOff,
    heatmap,
    performers,
    effectiveness,
    categories,
    timeZoneLabel,
  } = data;

  const topPerformers = performers.ranked.slice(0, 8);
  const bottomPerformers = [...performers.ranked]
    .filter((r) => r.activeAssignments > 0)
    .slice(-3)
    .reverse();

  const planChartRows = effectiveness.slice(0, 10).map((r) => ({
    ...r,
    label: r.titleShort,
  }));

  const categoryRows = [...categories].sort(
    (a, b) => b.totalAssignments - a.totalAssignments,
  );

  const platformTotal =
    summary.platformMixInPeriod.web +
    summary.platformMixInPeriod.slack +
    summary.platformMixInPeriod.teams +
    summary.platformMixInPeriod.other;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">How to read this page:</span> every
        number comes from your org&apos;s assignments (excluding cancelled), plan steps,
        and step completions. The date range is{" "}
        <span className="font-medium text-foreground">{periodLabel}</span> for activity
        charts; funnel and progress use current assignment state plus all completions.
      </div>

      {/* At a glance */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          At a glance
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightStat
            icon={<Layers className="h-5 w-5" />}
            label="Assignments in scope"
            value={String(summary.totalAssignments)}
            hint="Non-cancelled rows"
          />
          <InsightStat
            icon={<Activity className="h-5 w-5" />}
            label="Active / overdue"
            value={`${summary.assignmentsActive} / ${summary.assignmentsOverdue}`}
            hint="Active includes past-due until marked done"
          />
          <InsightStat
            icon={<Target className="h-5 w-5" />}
            label="Avg progress (active work)"
            value={`${summary.avgStepProgressActivePercent}%`}
            hint="Steps done ÷ plan N, averaged per assignment"
          />
          <InsightStat
            icon={<Users className="h-5 w-5" />}
            label="People assigned / active"
            value={`${summary.uniqueEmployeesAssigned} / ${summary.employeesWithActiveOrOverdue}`}
            hint="Anyone with an active or overdue assignment"
          />
          <InsightStat
            icon={<Zap className="h-5 w-5" />}
            label="Step completions (period)"
            value={String(summary.stepCompletionsInPeriod)}
            hint="Logged in selected date range"
          />
          <InsightStat
            icon={<TrendingUp className="h-5 w-5" />}
            label="People completing (period)"
            value={String(summary.distinctEmployeesCompletingInPeriod)}
            hint="Unique assignees with ≥1 completion in range"
          />
          <InsightStat
            icon={<MonitorSmartphone className="h-5 w-5" />}
            label="Proof attached (period)"
            value={`${summary.percentCompletionsWithEvidenceInPeriod}%`}
            hint="Completions with non-empty evidence JSON"
          />
          <InsightStat
            icon={<BarChart3 className="h-5 w-5" />}
            label="Plans deployed"
            value={String(summary.distinctPlansDeployed)}
            hint="Distinct plans on assignments"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Not started (no step logged yet):{" "}
          <span className="font-medium text-foreground">
            {summary.assignmentsNotStarted}
          </span>
          . Fully marked complete (status):{" "}
          <span className="font-medium text-foreground">
            {summary.assignmentsCompletedStatus}
          </span>
          . Org-wide avg progress (all in-scope):{" "}
          <span className="font-medium text-foreground">
            {summary.avgStepProgressAllNonCancelledPercent}%
          </span>
          .
        </p>
      </section>

      {/* Velocity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Speed & throughput
        </h2>
        <p className="text-xs text-muted-foreground">
          Times are measured from real timestamps. Samples show how many assignments
          contributed — small samples mean medians can swing.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightStat
            icon={<Clock className="h-5 w-5" />}
            label="Median time to first step"
            value={fmtHours(velocity.medianHoursToFirstStep)}
            hint={`New assigns in period with ≥1 step (n=${velocity.sampleStartedInPeriod})`}
          />
          <InsightStat
            icon={<Clock className="h-5 w-5" />}
            label="Median first → last step"
            value={fmtHours(velocity.medianHoursBetweenFirstAndLastStep)}
            hint={`≥2 completions on same assignment (n=${velocity.sampleMultiStepEvents})`}
          />
          <InsightStat
            icon={<Zap className="h-5 w-5" />}
            label="Median time to finish (all steps)"
            value={fmtHours(velocity.medianHoursToFullyFinish)}
            hint={`Every plan step completed (n=${velocity.fullyFinishedCount})`}
          />
          <InsightStat
            icon={<Users className="h-5 w-5" />}
            label="Avg learner progress (active)"
            value={`${performers.orgAverageStepProgressPercent}%`}
            hint="Among people with active/overdue assignments"
          />
        </div>
      </section>

      {/* Funnel + heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Step reach (cumulative)"
          subtitle={`Among ${dropOff.assignmentsWithAtLeastOneStep} assignments that started at least step 1 — each bar is how many reached at least that step number.`}
        >
          {dropOff.stepCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dropOff.stepCounts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="step"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `≥ ${v}`}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(value) => [
                    `${value ?? 0} assignments`,
                    "Reached",
                  ]}
                  labelFormatter={(s) => `Step ${String(s)}+`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dropOff.stepCounts.map((entry) => (
                    <Cell
                      key={entry.step}
                      fill={
                        entry.step === dropOff.biggestDropStep && dropOff.biggestDropPercentage > 0
                          ? "#ef4444"
                          : "#3b82f6"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
          {dropOff.biggestDropStep > 0 && dropOff.biggestDropPercentage > 0 ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              Largest relative drop toward step {dropOff.biggestDropStep}:{" "}
              {dropOff.biggestDropPercentage}% fewer assignments reach that depth than the
              prior step.
            </p>
          ) : null}
          {dropOff.hardStepNotes.length > 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Learner notes (high difficulty)</p>
              <ul className="mt-1 list-inside list-disc">
                {dropOff.hardStepNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </ChartCard>

        <ChartCard
          title={`When steps complete (${timeZoneLabel})`}
          subtitle="Counts step completions whose timestamps fall in the selected period."
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={heatmap}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}:00`}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="completionCount"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Platform mix */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Where completions happen (period)
        </h2>
        {platformTotal > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="By platform" subtitle="From step_completions.platform_completed_on">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  layout="vertical"
                  data={[
                    { name: "Web", v: summary.platformMixInPeriod.web },
                    { name: "Slack", v: summary.platformMixInPeriod.slack },
                    { name: "Teams", v: summary.platformMixInPeriod.teams },
                    { name: "Other / unset", v: summary.platformMixInPeriod.other },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="v" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No completions in this period — platform mix will appear once employees finish
            steps.
          </p>
        )}
      </section>

      {/* People */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Learners — progress on active work"
          subtitle="Average % of plan steps done across active & overdue assignments only."
        >
          {topPerformers.length > 0 ? (
            <div className="space-y-3">
              {topPerformers.map((p) => (
                <div
                  key={p.userId}
                  className="flex flex-col gap-1 border-b border-border/80 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/team/${p.userId}`}
                      className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {p.activeAssignments} active assignment
                      {p.activeAssignments === 1 ? "" : "s"} · {p.stepsCompletedInPeriod}{" "}
                      steps in period
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, p.stepProgressPercent)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-medium tabular-nums text-foreground">
                      {p.stepProgressPercent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active or overdue assignments right now — assign plans to see learner
              progress here.
            </p>
          )}
        </ChartCard>

        <ChartCard
          title="Needs attention (lowest progress)"
          subtitle="Same metric as above; only shown if multiple active learners exist."
        >
          {bottomPerformers.length > 0 ? (
            <div className="space-y-3">
              {bottomPerformers.map((p) => (
                <div
                  key={p.userId}
                  className="flex flex-col gap-1 border-b border-border/80 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/team/${p.userId}`}
                      className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {p.activeAssignments} active · {p.stepsCompletedInPeriod} steps (period)
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {p.stepProgressPercent}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough concurrent active learners to rank a bottom group.
            </p>
          )}
        </ChartCard>
      </div>

      {/* Plans + categories */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Plans — coverage & progress"
          subtitle="Per plan: assignment volume, how many are marked complete, and average step progress."
        >
          {planChartRows.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(240, planChartRows.length * 36)}>
              <BarChart data={planChartRows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(value, name) => {
                    if (name === "avgStepProgressPercent")
                      return [`${value ?? 0}%`, "Avg progress"];
                    return [value, name];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { title?: string } | undefined;
                    return row?.title ?? "";
                  }}
                />
                <Bar dataKey="avgStepProgressPercent" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            {effectiveness.slice(0, 6).map((r) => (
              <li key={r.planId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 font-medium text-foreground">
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link href={`/dashboard/plans/${r.planId}`}>{r.title}</Link>
                  </Button>
                  <span className="ml-2 text-muted-foreground">({r.contentType})</span>
                </span>
                <span className="tabular-nums">
                  {r.assignmentsTotal} assign · {r.assignmentsCompletedStatus} done ·{" "}
                  {r.avgStepProgressPercent}% avg
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title="Assignments created in period — by category"
          subtitle="Completion % is assignment status = completed, for assigns created in range."
        >
          {categoryRows.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, categoryRows.length * 40)}>
              <BarChart data={categoryRows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(v, name) => {
                    if (name === "avgCompletionRate")
                      return [`${v ?? 0}%`, "Status complete"];
                    return [v, name];
                  }}
                />
                <Bar dataKey="avgCompletionRate" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">
              No assignments were created in this date range — widen the window or create
              assigns to see category mix.
            </p>
          )}
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {categoryRows.map((c) => (
              <li key={c.category}>
                <span className="font-medium text-foreground">{c.category}</span> —{" "}
                {c.completedAssignments}/{c.totalAssignments} completed (
                {c.avgCompletionRate}%)
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}

function InsightStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      Nothing to chart yet.
    </div>
  );
}
