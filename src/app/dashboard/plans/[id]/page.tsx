import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { ContentAnalysis } from "@/lib/ai/contentAnalyzer";
import { parseOrgContext } from "@/lib/ai/orgContext";
import type { ValidationResult } from "@/lib/ai/planValidator";
import { defaultProofForStep } from "@/lib/proof";
import { createClient } from "@/lib/supabase/server";

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

  const { data: plan, error } = await supabase
    .from("plans")
    .select(
      "id, title, target_role, is_template, content_item_id, content_analysis, quality_scores, original_ai_draft, current_version",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !plan) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

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

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Plans
        </Link>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-stone-900">
          {plan.title}
        </h1>
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
    </div>
  );
}
