import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ListChecks,
} from "lucide-react";

import { EmptyState } from "@/components/design/empty-state";
import { HeroPanelCta } from "@/components/design/hero-panel-cta";
import { StatCard } from "@/components/design/stat-card";
import { TimeOfDayGreeting } from "@/components/employee/time-of-day-greeting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  fetchEmployeeAssignmentSummaries,
  isActiveAssignment,
  pickNextAssignment,
} from "@/lib/employee/assignment-summaries";
import { getEmployeeSessionProfile } from "@/lib/employee/session-profile";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeeHomePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const profile = await getEmployeeSessionProfile(user.id, user.email);
  if (!profile) redirect("/post-login");

  const summaries = await fetchEmployeeAssignmentSummaries(supabase, user.id);
  const next = pickNextAssignment(summaries);
  const active = summaries.filter(isActiveAssignment);
  const completed = summaries.filter((s) => s.label === "Completed");
  const overdue = active.filter((s) => s.label === "Overdue");
  const preview = summaries.slice(0, 4);

  return (
    <div className="space-y-10 pb-8">
      <section className="relative overflow-hidden rounded-xl bg-sidebar px-5 py-8 shadow-lg sm:px-8 sm:py-10">
        <div className="grain absolute inset-0 rounded-xl" />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,115,74,0.12),transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-sidebar-foreground/60">
            {profile.orgName}
          </p>
          <TimeOfDayGreeting firstName={profile.firstName} />
          <ul className="mt-4 max-w-lg space-y-2.5 text-sm leading-snug text-sidebar-foreground/72 sm:text-base sm:leading-relaxed">
            <li className="flex gap-2.5">
              <ListChecks
                className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary"
                aria-hidden
              />
              <span>
                <span className="font-medium text-sidebar-foreground/90">My Plans</span> is your
                list—everything assigned to you is there.
              </span>
            </li>
            <li className="flex gap-2.5">
              <ListChecks
                className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary"
                aria-hidden
              />
              <span>Open a plan, work the steps in order, add proof only when a step asks for it.</span>
            </li>
            <li className="flex gap-2.5">
              <ListChecks
                className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary"
                aria-hidden
              />
              <span>Progress saves as you go—no digging through email.</span>
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <HeroPanelCta href="/employee/my-plans">
              <BookOpen className="h-4 w-4 shrink-0 opacity-95" />
              My Plans
            </HeroPanelCta>
            {next ? (
              <Link
                href={`/employee/my-plans/${next.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-sidebar-border/90 bg-transparent px-5 text-base font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                Continue plan
                <ArrowRight className="h-4 w-4 shrink-0 opacity-90" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          value={String(active.length)}
          label="Active plans"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={String(completed.length)}
          label="Completed"
        />
        <StatCard
          icon={<ListChecks className="h-5 w-5" />}
          value={String(overdue.length)}
          label="Overdue"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          value={String(summaries.length)}
          label="Total assigned"
        />
      </section>

      {next ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            What to do next
          </h2>
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{next.title}</p>
                    <Badge variant={next.variant}>{next.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {next.done} of {next.total} steps complete
                    {next.due ? (
                      ` · Due ${new Date(next.due).toLocaleDateString()}`
                    ) : null}
                  </p>
                  {next.assignerNote?.trim() ? (
                    <p className="text-sm leading-snug text-foreground/85">
                      <span className="font-medium text-muted-foreground">Manager note: </span>
                      {next.assignerNote.trim()}
                    </p>
                  ) : null}
                  <Progress
                    value={next.total > 0 ? (next.done / next.total) * 100 : 0}
                    className="max-w-md"
                  />
                </div>
                <Button asChild className="h-11 rounded-lg px-4">
                  <Link href={`/employee/my-plans/${next.id}`}>
                    Open plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Your assigned plans
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Open any plan to work through steps and submit proof.
            </p>
          </div>
          {summaries.length > 0 ? (
            <Link
              href="/employee/my-plans"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>

        {summaries.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No plans yet"
            description="When someone on your team assigns a training plan to you, it will show up here and under My Plans."
          />
        ) : (
          <ul className="space-y-3">
            {preview.map((r) => (
              <li key={r.id}>
                <Link href={`/employee/my-plans/${r.id}`} className="block">
                  <Card
                    className={`transition-colors hover:border-border hover:bg-secondary/90 ${
                      next?.id === r.id
                        ? "border-primary/30 bg-[linear-gradient(180deg,rgba(212,97,60,0.18),rgba(232,224,213,0.35))] ring-1 ring-primary/15"
                        : ""
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          {next?.id === r.id ? (
                            <div className="mb-1 flex items-center gap-2">
                              <span className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                Next up
                              </span>
                            </div>
                          ) : null}
                          <p className="font-medium text-foreground">{r.title}</p>
                          {r.assignerNote?.trim() ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                              <span className="font-medium text-foreground/75">Note: </span>
                              {r.assignerNote.trim()}
                            </p>
                          ) : null}
                          {r.due ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Due {new Date(r.due).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={r.variant}>{r.label}</Badge>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {r.done} / {r.total} steps
                          </span>
                        </div>
                        <Progress
                          value={r.total > 0 ? (r.done / r.total) * 100 : 0}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {summaries.length > preview.length ? (
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              asChild
              className="rounded-lg border-border px-4"
            >
              <Link href="/employee/my-plans">
                See all {summaries.length} plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
