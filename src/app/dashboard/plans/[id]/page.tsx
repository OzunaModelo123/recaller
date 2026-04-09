import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/design/page-header";
import type { ContentAnalysis } from "@/lib/ai/contentAnalyzer";
import { parseOrgContext } from "@/lib/ai/orgContext";
import type { ValidationResult } from "@/lib/ai/planValidator";
import {
  CompletionFunnel,
  type FunnelStepDatum,
} from "@/components/dashboard/completion-funnel";
import { fetchPlanAssignCandidates } from "@/lib/dashboard/plan-assign-candidates";
import { defaultProofForStep } from "@/lib/proof";
import { createClient } from "@/lib/supabase/server";

import { PlanAssignSheet } from "./plan-assign-sheet";
import { PlanEditor } from "./plan-editor";

type Props = { params: Promise<{ id: string }> };

function asValidation(v: unknown): ValidationResult | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const scores = o.scores;
  if (!scores || typeof scores !== "object") return null;
  const s = scores as Record<string, unknown>;
  return {
    scores: {
      relevance: Number(s.relevance) || 0,
      specificity: Number(s.specificity) || 0,
      progressiveness: Number(s.progressiveness) || 0,
      feasibility: Number(s.feasibility) || 0,
      measurability: Number(s.measurability) || 0,
    },
    overall_score: Number(o.overall_score) || 0,
    forbidden_activity_violation: Boolean(o.forbidden_activity_violation),
    feedback: typeof o.feedback === "string" ? o.feedback : "",
    pass: Boolean(o.pass),
  };
}

function asAnalysis(v: unknown): ContentAnalysis | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const strArr = (k: string): string[] =>
    Array.isArray(o[k])
      ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  const complexity = o.complexity;
  const c =
    complexity === "beginner" ||
    complexity === "intermediate" ||
    complexity === "advanced"
      ? complexity
      : "intermediate";
  return {
    key_concepts: strArr("key_concepts"),
    skills_taught: strArr("skills_taught"),
    behavioral_changes_advocated: strArr("behavioral_changes_advocated"),
    applicable_roles: strArr("applicable_roles"),
    complexity: c,
    category: typeof o.category === "string" ? o.category : "",
    estimated_content_quality: Number(o.estimated_content_quality) || 3,
    risk_flags: strArr("risk_flags"),
    summary: typeof o.summary === "string" ? o.summary : "",
  };
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  const { data: plan, error } = await supabase
    .from("plans")
    .select(
      "id, title, target_role, is_template, content_item_id, content_analysis, quality_scores, original_ai_draft, current_version, org_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !plan) notFound();
  if (profile?.org_id && plan.org_id !== profile.org_id) {
    notFound();
  }

  const assignCandidates =
    profile?.org_id != null
      ? await fetchPlanAssignCandidates(supabase, profile.org_id)
      : [];

  const { data: steps } = await supabase
    .from("plan_steps")
    .select(
      "step_number, title, instructions, success_criteria, video_timestamp_start, video_timestamp_end, estimated_minutes, proof_type, proof_instructions",
    )
    .eq("plan_id", id)
    .order("step_number", { ascending: true });

  let contentReady = false;
  let hasTranscript = false;
  if (plan.content_item_id) {
    const { data: ci } = await supabase
      .from("content_items")
      .select("status, transcript")
      .eq("id", plan.content_item_id)
      .maybeSingle();
    contentReady = ci?.status === "ready";
    hasTranscript = Boolean(ci?.transcript?.trim());
  }

  const { data: org } = profile?.org_id
    ? await supabase
        .from("organisations")
        .select("org_context")
        .eq("id", profile.org_id)
        .maybeSingle()
    : { data: null };

  const ctx = parseOrgContext(org?.org_context);
  const roleOptions =
    ctx.roles.length > 0
      ? ctx.roles.map((r) => r.name)
      : ["All roles"];

  const stepRows =
    steps?.map((s) => {
      const proof = defaultProofForStep({
        proof_type: s.proof_type,
        proof_instructions: s.proof_instructions,
        success_criteria: s.success_criteria,
      });
      return {
        step_number: s.step_number,
        title: s.title,
        instructions: s.instructions,
        success_criteria: s.success_criteria,
        video_timestamp_start: s.video_timestamp_start,
        video_timestamp_end: s.video_timestamp_end,
        estimated_minutes: s.estimated_minutes,
        proof_type: proof.proof_type,
        proof_instructions: proof.proof_instructions,
      };
    }) ?? [];

  const n = stepRows.length;
  let funnelData: FunnelStepDatum[] = [];
  if (profile?.org_id && n > 0) {
    const { data: assignRows } = await supabase
      .from("assignments")
      .select("id")
      .eq("plan_id", id)
      .eq("org_id", profile.org_id)
      .neq("status", "cancelled");
    const aids = (assignRows ?? []).map((a) => a.id);
    const counts = new Array<number>(n).fill(0);
    if (aids.length > 0) {
      const { data: compRows } = await supabase
        .from("step_completions")
        .select("step_number")
        .in("assignment_id", aids);
      for (const c of compRows ?? []) {
        const i = c.step_number - 1;
        if (i >= 0 && i < n) counts[i] += 1;
      }
    }
    funnelData = counts.map((completed, idx) => ({
      stepLabel: `Step ${idx + 1}`,
      completed,
    }));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Plans
        </Link>
        <PageHeader
          title={plan.title}
          subtitle="When this plan is ready, use Assign to employee so it appears in their My Plans and home overview."
          action={
            profile?.org_id ? (
              <PlanAssignSheet
                planId={plan.id}
                planTitle={plan.title}
                candidates={assignCandidates}
              />
            ) : undefined
          }
        />
      </div>

      <PlanEditor
        planId={plan.id}
        contentItemId={plan.content_item_id}
        contentReady={contentReady}
        hasTranscript={hasTranscript}
        targetRole={plan.target_role}
        roleOptions={roleOptions}
        title={plan.title}
        isTemplate={plan.is_template}
        steps={stepRows}
        hasDraft={plan.original_ai_draft != null}
        quality={asValidation(plan.quality_scores)}
        analysis={asAnalysis(plan.content_analysis)}
      />

      {funnelData.length > 0 ? (
        <CompletionFunnel
          title="Team completion funnel"
          subtitle="How many step completions were recorded per step across all non-cancelled assignments for this plan."
          data={funnelData}
        />
      ) : null}
    </div>
  );
}
