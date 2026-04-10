import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/design/page-header";
import { evidenceSummary } from "@/lib/dashboard/evidence-summary";
import { createClient } from "@/lib/supabase/server";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";
import type { Json } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function TeamMemberHistoryPage({ params }: Props) {
  const { id: memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!me?.org_id || (me.role !== "admin" && me.role !== "super_admin")) {
    redirect("/employee");
  }

  const { data: member } = await supabase
    .from("users")
    .select("id, full_name, email, title, org_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (!member || member.org_id !== me.org_id) {
    notFound();
  }

  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      `
      id,
      status,
      due_date,
      created_at,
      plans ( id, title )
    `,
    )
    .eq("org_id", me.org_id)
    .eq("assigned_to", memberId)
    .order("created_at", { ascending: false });

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  let completions: {
    id: string;
    assignment_id: string;
    step_number: number;
    completed_at: string;
    evidence: Json;
    note: string | null;
    platform_completed_on: string | null;
  }[] = [];

  if (assignmentIds.length > 0) {
    const { data: sc } = await supabase
      .from("step_completions")
      .select(
        "id, assignment_id, step_number, completed_at, evidence, note, platform_completed_on",
      )
      .in("assignment_id", assignmentIds)
      .order("completed_at", { ascending: false });
    completions = sc ?? [];
  }

  const label = member.full_name?.trim() || member.email;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/dashboard/team"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Team
        </Link>
        <PageHeader
          title={label}
          subtitle={`${member.title?.trim() ? `${member.title} · ` : ""}${member.email} · ${member.role.replace("_", " ")}`}
        />
      </div>

      <div className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Assignment history and evidence
        </h2>
        {(assignments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assignments yet for this person.
          </p>
        ) : (
          (assignments ?? []).map((a) => {
            const plan = unwrapRelation(
              a.plans as unknown as
                | { id: string; title: string }
                | { id: string; title: string }[]
                | null,
            );
            const rows = completions.filter((c) => c.assignment_id === a.id);
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
              >
                <div className="border-b border-border px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {plan?.title ?? "Plan"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Status:{" "}
                        <span className="capitalize text-foreground/80">{a.status}</span>
                        {a.due_date
                          ? ` · Due ${fmtWhen(a.due_date)}`
                          : ""}
                      </p>
                    </div>
                    {plan?.id ? (
                      <Link
                        href={`/dashboard/plans/${plan.id}`}
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        View plan
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="px-5 py-4">
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No steps completed yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {rows.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-xl border border-border bg-background/50 px-4 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                              Step {c.step_number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtWhen(c.completed_at)}
                              {c.platform_completed_on
                                ? ` · ${c.platform_completed_on}`
                                : ""}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              Evidence:{" "}
                            </span>
                            {evidenceSummary(c.evidence)}
                          </p>
                          {c.note?.trim() ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Note: {c.note}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
