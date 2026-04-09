"use client";

import { useMemo, useState } from "react";
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
  AlertTriangle,
  Clock,
  Layers,
  MonitorSmartphone,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import type { LiveAnalyticsPayload } from "@/lib/dashboard/load-insights";

function truncateLabel(text: string, max = 40): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function fmtHours(v: number | null): string {
  if (v == null) return "—";
  if (v < 0.1) return "< 0.1h";
  return `${v}h`;
}

type MetricDef = {
  id: string;
  label: string;
  value: string;
  shortHelp: string;
  why: string;
  calc: string;
  icon: React.ReactNode;
};

export function InsightsCharts(data: LiveAnalyticsPayload) {
  const {
    summary,
    velocity,
    dropOff,
    heatmap,
    performers,
    effectiveness,
    categories,
    timeZoneLabel,
  } = data;

  const keyMetrics = useMemo<MetricDef[]>(
    () => [
      {
        id: "coverage",
        label: "Assignments live",
        value: String(summary.totalAssignments),
        shortHelp: "How much work is currently in the system.",
        why: "Managers need to know the size of the active training load before reading any other metric.",
        calc: "All assignments except cancelled.",
        icon: <Layers className="h-4 w-4" />,
      },
      {
        id: "progress",
        label: "Avg progress",
        value: `${summary.avgStepProgressActivePercent}%`,
        shortHelp: "How far active work has moved.",
        why: "This shows whether current assignments are actually moving, not just being assigned.",
        calc: "For active/overdue assignments: distinct completed steps divided by that plan's total steps, then averaged.",
        icon: <Target className="h-4 w-4" />,
      },
      {
        id: "overdue",
        label: "Overdue work",
        value: String(summary.assignmentsOverdue),
        shortHelp: "What likely needs follow-up.",
        why: "This is the fastest way to spot work that may need reminders, manager help, or timeline changes.",
        calc: "Active assignments with a due date earlier than now.",
        icon: <AlertTriangle className="h-4 w-4" />,
      },
      {
        id: "participation",
        label: "People active",
        value: `${summary.employeesWithActiveOrOverdue}/${summary.uniqueEmployeesAssigned}`,
        shortHelp: "Who currently has work to do.",
        why: "Separates total assigned people from the subset who still have open work.",
        calc: "Employees with at least one active or overdue assignment over all employees assigned at least once.",
        icon: <Users className="h-4 w-4" />,
      },
      {
        id: "velocity",
        label: "Time to start",
        value: fmtHours(velocity.medianHoursToFirstStep),
        shortHelp: "How quickly people begin after assignment.",
        why: "A slow start usually points to unclear instructions, weak handoff, or low urgency.",
        calc: "Median hours from assignment creation to first completed step for assignments created in the period and started.",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        id: "throughput",
        label: "Steps completed",
        value: String(summary.stepCompletionsInPeriod),
        shortHelp: "Total execution in the selected period.",
        why: "This is your cleanest activity measure for how much work actually happened.",
        calc: "Count of step completion rows in the current activity window.",
        icon: <Zap className="h-4 w-4" />,
      },
      {
        id: "evidence",
        label: "Proof attached",
        value: `${summary.percentCompletionsWithEvidenceInPeriod}%`,
        shortHelp: "How often work is backed by evidence.",
        why: "Completion volume matters more when managers can verify quality or proof of execution.",
        calc: "Completions in period with a non-empty evidence JSON payload divided by all completions in period.",
        icon: <MonitorSmartphone className="h-4 w-4" />,
      },
      {
        id: "momentum",
        label: "People completing",
        value: String(summary.distinctEmployeesCompletingInPeriod),
        shortHelp: "Breadth of engagement, not just volume.",
        why: "A few heavy users can hide low team adoption. This shows how many people are actually moving.",
        calc: "Unique assignees with at least one step completion in the period.",
        icon: <TrendingUp className="h-4 w-4" />,
      },
    ],
    [summary, velocity],
  );

  const [selectedMetricId, setSelectedMetricId] = useState<string>(keyMetrics[0]?.id ?? "");
  const selectedMetric =
    keyMetrics.find((m) => m.id === selectedMetricId) ?? keyMetrics[0];

  const topPerformers = performers.ranked.slice(0, 6);
  const planRows = effectiveness.slice(0, 8).map((r) => ({
    ...r,
    label: r.titleShort,
  }));
  const categoryRows = [...categories].sort((a, b) => b.totalAssignments - a.totalAssignments);
  const platformRows = [
    { name: "Web", value: summary.platformMixInPeriod.web },
    { name: "Slack", value: summary.platformMixInPeriod.slack },
    { name: "Teams", value: summary.platformMixInPeriod.teams },
    { name: "Other", value: summary.platformMixInPeriod.other },
  ].filter((row) => row.value > 0);

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Overview
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              The important numbers
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Start here. Click a card to see what it means and why it matters.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
            Local time: {timeZoneLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {keyMetrics.map((metric) => {
            const active = metric.id === selectedMetric?.id;
            return (
              <button
                key={metric.id}
                type="button"
                onClick={() => setSelectedMetricId(metric.id)}
                className={`flex min-h-[9.5rem] flex-col rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-xs)] transition-all ${
                  active
                    ? "border-primary/35 ring-1 ring-primary/15 shadow-[var(--shadow-sm)]"
                    : "border-border hover:border-primary/20 hover:shadow-[var(--shadow-sm)]"
                }`}
              >
                <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5 shrink-0">{metric.icon}</span>
                  <span className="min-w-0 text-xs font-medium leading-snug">{metric.label}</span>
                </div>
                <p className="mt-3 break-words text-xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-auto pt-3 text-xs leading-snug text-muted-foreground line-clamp-3">
                  {metric.shortHelp}
                </p>
              </button>
            );
          })}
        </div>

        {selectedMetric ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <span className="shrink-0">{selectedMetric.icon}</span>
              <span className="min-w-0">{selectedMetric.label}</span>
            </div>
            <p className="mt-2 break-words text-2xl font-semibold leading-tight tabular-nums text-foreground">
              {selectedMetric.value}
            </p>
            <Separator className="my-4" />
            <div className="grid gap-6 md:grid-cols-2 md:gap-8">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Why this matters
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {selectedMetric.why}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  How it is calculated
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {selectedMetric.calc}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <SectionHeader
        eyebrow="Execution"
        title="Progress and momentum"
        subtitle="See where learners stall, when work gets done, and who is carrying the workload."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Where people stop progressing"
          subtitle="Each bar shows how many started assignments reached at least that step."
        >
          {dropOff.stepCounts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dropOff.stepCounts}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="step" tick={{ fontSize: 12 }} tickFormatter={(v) => `Step ${v}`} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                    formatter={(value) => [`${value ?? 0}`, "Assignments reached"]}
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
              <p className="mt-3 text-sm text-muted-foreground">
                {dropOff.biggestDropStep > 0
                  ? `The biggest fall happens before step ${dropOff.biggestDropStep}. ${dropOff.biggestDropPercentage}% fewer assignments make it that far than the step before.`
                  : "No meaningful drop-off point yet."}
              </p>
              {dropOff.hardStepNotes.length > 0 ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What learners said
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {dropOff.hardStepNotes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard
          title="When completions happen"
          subtitle={`Completion timestamps grouped into the viewer's local timezone (${timeZoneLabel}).`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={heatmap}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}:00`} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
                formatter={(value) => [`${value ?? 0}`, "Completions"]}
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

      <SectionHeader
        eyebrow="People and channels"
        title="Who is engaging"
        subtitle="Track who is making progress and where completions are being submitted."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Who is moving work forward"
          subtitle="Ranked by average progress across active and overdue assignments."
        >
          {topPerformers.length > 0 ? (
            <div className="space-y-3">
              {topPerformers.map((person) => (
                <div
                  key={person.userId}
                  className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/team/${person.userId}`}
                      className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {person.name}
                    </Link>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {person.activeAssignments} open assignment
                      {person.activeAssignments === 1 ? "" : "s"} · {person.stepsCompletedInPeriod}{" "}
                      steps this period
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground sm:text-right">
                    {person.stepProgressPercent}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyText text="No active learner progress to rank yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Where completions happen"
          subtitle="Share of logged step completions by channel in the current activity window."
        >
          {platformRows.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformRows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                    formatter={(value) => [`${value ?? 0}`, "Completions"]}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-sm text-muted-foreground">
                Web: {summary.platformMixInPeriod.web} · Slack: {summary.platformMixInPeriod.slack} · Teams:{" "}
                {summary.platformMixInPeriod.teams}
              </p>
            </>
          ) : (
            <EmptyText text="No completions have been logged in this period yet." />
          )}
        </ChartCard>
      </div>

      <SectionHeader
        eyebrow="Content performance"
        title="What is working best"
        subtitle="Compare plans and categories using completion and progress, not just raw assignment volume."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Which plans are landing best"
          subtitle="Average progress is usually more informative than only counting status-complete."
        >
          {planRows.length > 0 ? (
            <>
              <div className="min-w-0 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(260, planRows.length * 40)}>
                  <BarChart data={planRows} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={168}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => truncateLabel(String(v), 34)}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        maxWidth: 320,
                      }}
                      formatter={(value, name) => {
                        if (name === "avgStepProgressPercent") return [`${value ?? 0}%`, "Avg progress"];
                        return [value, name];
                      }}
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { title?: string } | undefined)?.title ?? ""
                    }
                    />
                    <Bar dataKey="avgStepProgressPercent" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto overflow-x-hidden rounded-lg border border-border/70 bg-muted/15 p-3">
                {effectiveness.slice(0, 5).map((plan) => (
                  <div
                    key={plan.planId}
                    className="flex flex-col gap-1 border-b border-border/50 py-2 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <Link
                      href={`/dashboard/plans/${plan.planId}`}
                      className="min-w-0 flex-1 text-sm font-medium leading-snug text-primary underline-offset-4 hover:underline"
                    >
                      <span className="line-clamp-2 break-words">{plan.title}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground sm:max-w-[11rem] sm:text-right">
                      {plan.assignmentsTotal} assigned · {plan.avgStepProgressPercent}% avg
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard
          title="Category performance"
          subtitle="Based on assignments created in the current activity window."
        >
          {categoryRows.length > 0 ? (
            <>
              <div className="min-w-0 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(240, categoryRows.length * 44)}>
                  <BarChart data={categoryRows} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={128}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => truncateLabel(String(v), 22)}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                      formatter={(value) => [`${value ?? 0}%`, "Completed"]}
                    />
                    <Bar dataKey="avgCompletionRate" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Use this to compare where teams finish assigned work most consistently.
              </p>
            </>
          ) : (
            <EmptyText text="No assignments were created in the current activity window." />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <h3 className="text-sm font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-4 min-w-0">{children}</div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2 border-b border-border/60 pb-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      Nothing to chart yet.
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
