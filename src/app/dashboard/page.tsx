import Link from "next/link";
import {
  Upload,
  Sparkles,
  Send,
  ArrowUpRight,
  BookOpen,
  Users,
  TrendingUp,
  Activity,
  Zap,
  ClipboardList,
  AlertCircle,
  UserCircle,
  CalendarCheck,
  LayoutList,
} from "lucide-react";

import { DashboardWorkflowStrip } from "@/components/dashboard/dashboard-workflow-strip";
import { HeroPanelCta } from "@/components/design/hero-panel-cta";
import {
  completionPercent,
  evidenceSummary,
  trafficDotClass,
  trafficTier,
} from "@/lib/dashboard/evidence-summary";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";
import type { Json } from "@/types/database";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

const steps = [
  {
    title: "Upload training content",
    description: "Add a YouTube video, PDF, or document to your content library.",
    icon: Upload,
    href: "/dashboard/content/upload",
    accent: "from-primary/18 via-secondary/10 to-transparent",
    iconColor: "text-primary",
    number: "01",
  },
  {
    title: "Generate AI plans",
    description: "AI creates actionable, multi-step learning plans from your content.",
    icon: Sparkles,
    href: "/dashboard/content",
    accent: "from-primary/18 via-secondary/10 to-transparent",
    iconColor: "text-primary",
    number: "02",
  },
  {
    title: "Assign to your team",
    description: "Distribute plans and track completion with evidence.",
    icon: Send,
    href: "/dashboard/assignments",
    accent: "from-primary/18 via-secondary/10 to-transparent",
    iconColor: "text-primary",
    number: "03",
  },
];

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  let fullName = "there";
  let orgName = "your organization";
  let role = "employee";
  let orgId: string | null = null;
  let contentCountLabel = "0";
  let teamCountLabel = "0";
  let plansCountLabel = "0";

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, role, org_id")
      .eq("id", user.id)
      .single();

    fullName = profile?.full_name || user.email?.split("@")[0] || "there";
    role = profile?.role ?? "employee";
    orgId = profile?.org_id ?? null;

    if (profile?.org_id) {
      const { data: org } = await supabase
        .from("organisations")
        .select("name")
        .eq("id", profile.org_id)
        .single();
      orgName = org?.name ?? orgName;
    }
  }

  const isAdmin = role === "admin" || role === "super_admin";

  if (isAdmin && orgId) {
    const [{ count: contentCount }, { count: teamCount }, { count: plansCount }] =
      await Promise.all([
        supabase
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),
        supabase
          .from("plans")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),
      ]);
    contentCountLabel = String(contentCount ?? 0);
    teamCountLabel = String(teamCount ?? 0);
    plansCountLabel = String(plansCount ?? 0);
  }

  const greeting = getGreeting();
  const firstName = getFirstName(fullName);

  let totalActivePlans = 0;
  let overallPct = 0;
  let employeesEngaged = 0;
  let overdueCount = 0;
  let completionsLast7d = 0;
  let activeAssignmentsCount = 0;
  let recentFeed: {
    when: string;
    who: string;
    plan: string;
    step: number;
    evidence: string;
  }[] = [];
  let planCards: {
    planId: string;
    title: string;
    assignmentCount: number;
    pct: number;
    tier: ReturnType<typeof trafficTier>;
  }[] = [];

  let memberAssignmentRows: {
    assignmentId: string;
    memberName: string;
    memberId: string;
    roleLabel: string;
    groupLabel: string;
    planTitle: string;
    planId: string;
    status: string;
  }[] = [];

  if (isAdmin && orgId) {
    const { data: assignments } = await supabase
      .from("assignments")
      .select(
        `
        id,
        plan_id,
        status,
        due_date,
        assigned_to,
        group_id,
        plans ( title ),
        assignee:users!assignments_assigned_to_fkey ( id, full_name, email, role ),
        groups ( name )
      `,
      )
      .eq("org_id", orgId);

    const activePlanIds = new Set(
      (assignments ?? [])
        .filter((a) => a.status === "active")
        .map((a) => a.plan_id),
    );
    totalActivePlans = activePlanIds.size;

    overdueCount = (assignments ?? []).filter((a) => {
      if (a.status !== "active" || !a.due_date) return false;
      // Server snapshot: compare due date string to "now" in ISO (UTC) for stable lint/purity.
      return a.due_date < new Date().toISOString();
    }).length;

    const nonCancelled = (assignments ?? []).filter(
      (a) => a.status !== "cancelled",
    );
    const planIds = [...new Set(nonCancelled.map((a) => a.plan_id))];
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

    const assignmentById = new Map(
      nonCancelled.map((a) => [a.id, a] as const),
    );
    const aIds = nonCancelled.map((a) => a.id);

    let expected = 0;
    for (const a of nonCancelled) {
      expected += nByPlan.get(a.plan_id) ?? 0;
    }

    const countByAssignment = new Map<string, number>();
    let allStepCompletions: {
      assignment_id: string;
      completed_at: string;
      step_number: number;
      evidence: unknown;
    }[] = [];

    if (aIds.length > 0) {
      const { data: sc } = await supabase
        .from("step_completions")
        .select("assignment_id, completed_at, step_number, evidence")
        .in("assignment_id", aIds)
        .order("completed_at", { ascending: false });
      allStepCompletions = sc ?? [];
      for (const c of allStepCompletions) {
        countByAssignment.set(
          c.assignment_id,
          (countByAssignment.get(c.assignment_id) ?? 0) + 1,
        );
      }
    }

    const completed = allStepCompletions.length;
    overallPct = completionPercent(completed, expected);

    const weekAgoIso = new Date(
      new Date().getTime() - 7 * 86400000,
    ).toISOString();
    completionsLast7d = allStepCompletions.filter(
      (c) => c.completed_at >= weekAgoIso,
    ).length;
    activeAssignmentsCount = (assignments ?? []).filter((a) => a.status === "active")
      .length;

    const engaged = new Set<string>();
    for (const c of allStepCompletions) {
      const row = assignmentById.get(c.assignment_id);
      if (row) engaged.add(row.assigned_to);
    }
    employeesEngaged = engaged.size;

    const recent = allStepCompletions.slice(0, 10);
    const enrichMap = new Map<
      string,
      { planTitle: string; assigneeName: string }
    >();
    for (const row of assignments ?? []) {
      const plan = unwrapRelation(
        row.plans as unknown as { title: string } | { title: string }[] | null,
      );
      const assignee = unwrapRelation(
        row.assignee as unknown as
          | { full_name: string | null; email: string }
          | { full_name: string | null; email: string }[]
          | null,
      );
      enrichMap.set(row.id, {
        planTitle: plan?.title ?? "Plan",
        assigneeName: assignee?.full_name?.trim() || assignee?.email || "—",
      });
    }

    recentFeed = recent
      .map((r) => {
        const e = enrichMap.get(r.assignment_id);
        if (!e) return null;
        return {
          when: fmtWhen(r.completed_at),
          who: e.assigneeName,
          plan: e.planTitle,
          step: r.step_number,
          evidence: evidenceSummary(r.evidence as Json),
        };
      })
      .filter(Boolean) as typeof recentFeed;

    memberAssignmentRows = (assignments ?? [])
      .filter((a) => a.status !== "cancelled")
      .map((row) => {
        const plan = unwrapRelation(
          row.plans as unknown as { title: string } | { title: string }[] | null,
        );
        const assignee = unwrapRelation(
          row.assignee as unknown as
            | { id: string; full_name: string | null; email: string; role: string }
            | {
                id: string;
                full_name: string | null;
                email: string;
                role: string;
              }[]
            | null,
        );
        const grp = unwrapRelation(
          row.groups as unknown as { name: string } | { name: string }[] | null,
        );
        const groupLabel = row.group_id
          ? grp?.name?.trim() || "Group"
          : "Direct assign";
        return {
          assignmentId: row.id,
          memberName: assignee?.full_name?.trim() || assignee?.email || "—",
          memberId: assignee?.id ?? row.assigned_to,
          roleLabel: formatRole(assignee?.role ?? "member"),
          groupLabel,
          planTitle: plan?.title ?? "Plan",
          planId: row.plan_id,
          status: row.status,
        };
      })
      .sort((a, b) =>
        a.memberName.localeCompare(b.memberName, undefined, {
          sensitivity: "base",
        }),
      );

    const byPlan = new Map<string, { assignmentIds: string[] }>();
    for (const a of nonCancelled) {
      const cur = byPlan.get(a.plan_id) ?? { assignmentIds: [] };
      cur.assignmentIds.push(a.id);
      byPlan.set(a.plan_id, cur);
    }

    if (byPlan.size > 0) {
      const { data: titles } = await supabase
        .from("plans")
        .select("id, title")
        .in("id", [...byPlan.keys()]);

      const titleById = new Map((titles ?? []).map((t) => [t.id, t.title] as const));

      planCards = [...byPlan.entries()].map(([planId, v]) => {
        let exp = 0;
        let comp = 0;
        const n = nByPlan.get(planId) ?? 0;
        for (const aid of v.assignmentIds) {
          exp += n;
          comp += countByAssignment.get(aid) ?? 0;
        }
        const pct = completionPercent(comp, exp);
        const tier = trafficTier(exp > 0 ? comp / exp : 0);
        return {
          planId,
          title: titleById.get(planId) ?? "Plan",
          assignmentCount: v.assignmentIds.length,
          pct,
          tier,
        };
      });

      planCards.sort((a, b) => b.assignmentCount - a.assignmentCount);
    }
  }

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-xl bg-sidebar px-8 py-10 shadow-lg">
        <div className="grain absolute inset-0 rounded-xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,115,74,0.15),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-3xl" />

        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-sidebar-foreground/60">
            {orgName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sidebar-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-sidebar-foreground/70">
            {isAdmin
              ? "Manage training content, generate AI-powered plans, and track how your team learns."
              : "Complete your assigned training plans and build real skills, one step at a time."}
          </p>
          {isAdmin && (
            <p className="mt-2 text-xs text-sidebar-foreground/55">
              Library: {contentCountLabel} items · {plansCountLabel} plans · Roster:{" "}
              {teamCountLabel} people
            </p>
          )}
          {isAdmin && (
            <div className="mt-6 flex flex-wrap gap-2">
              <HeroPanelCta href="/dashboard/content/upload" className="inline-flex">
                Upload content
                <ArrowUpRight className="h-4 w-4 shrink-0 opacity-90" />
              </HeroPanelCta>
              <Link
                href="/dashboard/assignments"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-sidebar-border/90 bg-transparent px-5 text-base font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                Manage assignments
                <ArrowUpRight className="h-4 w-4 shrink-0 opacity-90" />
              </Link>
              <Link
                href="/dashboard/insights"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-sidebar-border/90 bg-transparent px-5 text-base font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                View analytics
                <ArrowUpRight className="h-4 w-4 shrink-0 opacity-90" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {isAdmin && orgId ? <DashboardWorkflowStrip /> : null}

      {isAdmin && orgId ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              {
                label: "Active plans",
                value: String(totalActivePlans),
                hint: "Plans with at least one active assignment",
                icon: ClipboardList,
                href: "/dashboard/plans",
              },
              {
                label: "Active assignments",
                value: String(activeAssignmentsCount),
                hint: "Rows in progress (not cancelled)",
                icon: LayoutList,
                href: "/dashboard/assignments",
              },
              {
                label: "Overall completion",
                value: `${overallPct}%`,
                hint: "Steps done ÷ expected steps (per-plan N)",
                icon: TrendingUp,
                href: "/dashboard/assignments",
              },
              {
                label: "Step completions (7d)",
                value: String(completionsLast7d),
                hint: "Finished steps in the last week",
                icon: CalendarCheck,
                href: "/dashboard/insights",
              },
              {
                label: "Employees engaged",
                value: String(employeesEngaged),
                hint: "People with ≥1 completed step",
                icon: Users,
                href: "/dashboard/team",
              },
              {
                label: "Overdue assignments",
                value: String(overdueCount),
                hint: "Active & past due date",
                icon: AlertCircle,
                href: "/dashboard/assignments",
              },
            ] as const
          ).map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="group block rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
                    {stat.hint}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    Open
                    <ArrowUpRight className="ml-0.5 inline h-3 w-3 align-middle" />
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Content Items", value: contentCountLabel, icon: BookOpen },
            { label: "Team Members", value: teamCountLabel, icon: Users },
            { label: "Completion Rate", value: "0%", icon: TrendingUp },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && orgId && planCards.length > 0 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Plans in motion
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completion rate uses each plan&apos;s step count (dynamic N).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {planCards.map((p) => (
              <Link
                key={p.planId}
                href={`/dashboard/plans/${p.planId}`}
                className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 hover:border-primary/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.assignmentCount} assignment
                      {p.assignmentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${trafficDotClass(p.tier)}`}
                    title="Traffic light"
                  />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, p.pct)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {p.pct}%
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                  View plan
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {isAdmin && orgId && memberAssignmentRows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
              <UserCircle className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Assignments by member
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Who has each plan, their role, and whether it came from a group or a direct assign.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {memberAssignmentRows.map((r) => (
                  <tr
                    key={r.assignmentId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/team/${r.memberId}`}
                        className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        {r.memberName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{r.roleLabel}</td>
                    <td className="px-4 py-3">{r.groupLabel}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/plans/${r.planId}`}
                        className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        <span className="line-clamp-2">{r.planTitle}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {isAdmin && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Get started
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Three steps to transform your training workflow.
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link href="/dashboard/onboarding/context">Company context</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 hover:border-primary/20"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/70">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    Get started
                    <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
            </div>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" asChild>
              <Link href="/dashboard/assignments">Assignments</Link>
            </Button>
          </div>
          {isAdmin && orgId && recentFeed.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm">
              {recentFeed.map((r, i) => (
                <li
                  key={`${r.when}-${r.who}-${i}`}
                  className="rounded-lg border border-border/80 bg-background/50 px-3 py-2.5"
                >
                  <p className="text-xs text-muted-foreground">{r.when}</p>
                  <p className="mt-1 font-medium text-foreground">
                    {r.who}{" "}
                    <span className="font-normal text-muted-foreground">completed</span>{" "}
                    step {r.step}{" "}
                    <span className="font-normal text-muted-foreground">on</span>{" "}
                    {r.plan}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Evidence: {r.evidence}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              No activity yet. Once your team starts completing plans, their progress
              will appear here.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Charts for velocity, drop-off, and top performers — plus monthly AI reports when
            you have enough activity.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-lg" asChild>
              <Link href="/dashboard/insights">
                Open insights
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link href="/dashboard/team">Team performance</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
