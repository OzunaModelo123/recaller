"use server";

import { revalidatePath } from "next/cache";

import { embedApprovedPlan } from "@/lib/ai/embeddingService";
import { defaultProofForStep } from "@/lib/proof";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type StepRow = {
  step_number: number;
  title: string;
  instructions: string;
  success_criteria: string;
  video_timestamp_start: number | null;
  video_timestamp_end: number | null;
  estimated_minutes: number | null;
  proof_type: string;
  proof_instructions: string;
};

export type SavePlanState = {
  title: string;
  steps: StepRow[];
  is_template: boolean;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

type PlanAuthOk = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  orgId: string;
};

async function requireAdminPlan(
  planId: string,
): Promise<PlanAuthOk | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { error: "Forbidden" };
  }

  const { data: plan, error } = await supabase
    .from("plans")
    .select("id, org_id")
    .eq("id", planId)
    .single();

  if (error || !plan || plan.org_id !== profile.org_id) {
    return { error: "Plan not found" };
  }

  return { supabase, user, orgId: profile.org_id };
}

export async function savePlan(planId: string, state: SavePlanState): Promise<ActionResult> {
  const ctx = await requireAdminPlan(planId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { supabase, orgId } = ctx;

  if (state.steps.length < 2 || state.steps.length > 10) {
    return { ok: false, error: "Plan must have 2–10 steps" };
  }

  const current_version = {
    title: state.title,
    steps: state.steps.map((s) => ({
      step_number: s.step_number,
      title: s.title,
      instructions: s.instructions,
      success_criteria: s.success_criteria,
      video_timestamp_start: s.video_timestamp_start,
      video_timestamp_end: s.video_timestamp_end,
      estimated_minutes: s.estimated_minutes ?? 15,
      proof_type: s.proof_type,
      proof_instructions: s.proof_instructions,
    })),
  } satisfies Record<string, unknown>;

  const { error: upErr } = await supabase
    .from("plans")
    .update({
      title: state.title,
      current_version: current_version as Json,
      is_template: state.is_template,
    })
    .eq("id", planId);

  if (upErr) return { ok: false, error: upErr.message };

  const { error: delErr } = await supabase.from("plan_steps").delete().eq("plan_id", planId);
  if (delErr) return { ok: false, error: delErr.message };

  const inserts = state.steps.map((s) => ({
    plan_id: planId,
    step_number: s.step_number,
    title: s.title,
    instructions: s.instructions,
    success_criteria: s.success_criteria,
    video_timestamp_start: s.video_timestamp_start,
    video_timestamp_end: s.video_timestamp_end,
    estimated_minutes: s.estimated_minutes,
    proof_type: s.proof_type,
    proof_instructions: s.proof_instructions,
  }));

  const { error: insErr } = await supabase.from("plan_steps").insert(inserts);
  if (insErr) return { ok: false, error: insErr.message };

  try {
    await embedApprovedPlan(planId, orgId);
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Embedding failed" };
  }

  revalidatePath(`/dashboard/plans/${planId}`);
  revalidatePath("/dashboard/plans");
  return { ok: true };
}

export async function resetPlanToDraft(planId: string): Promise<ActionResult> {
  const ctx = await requireAdminPlan(planId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { supabase } = ctx;

  const { data: plan, error } = await supabase
    .from("plans")
    .select("original_ai_draft")
    .eq("id", planId)
    .single();

  if (error || !plan?.original_ai_draft) {
    return { ok: false, error: "No AI draft stored" };
  }

  const draft = plan.original_ai_draft as Record<string, unknown>;
  const title = typeof draft.title === "string" ? draft.title : "Plan";
  const stepsRaw = Array.isArray(draft.steps) ? draft.steps : [];

  const { error: upErr } = await supabase
    .from("plans")
    .update({
      title,
      current_version: plan.original_ai_draft as Json,
    })
    .eq("id", planId);

  if (upErr) return { ok: false, error: upErr.message };

  await supabase.from("plan_steps").delete().eq("plan_id", planId);

  const inserts = stepsRaw
    .map((s, idx) => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const success_criteria =
        typeof o.success_criteria === "string" ? o.success_criteria : "";
      const proof = defaultProofForStep({
        proof_type: o.proof_type,
        proof_instructions: o.proof_instructions,
        success_criteria,
      });
      return {
        plan_id: planId,
        step_number: typeof o.step_number === "number" ? o.step_number : idx + 1,
        title: typeof o.title === "string" ? o.title : "",
        instructions: typeof o.instructions === "string" ? o.instructions : "",
        success_criteria,
        video_timestamp_start:
          typeof o.video_timestamp_start === "number"
            ? o.video_timestamp_start
            : null,
        video_timestamp_end:
          typeof o.video_timestamp_end === "number" ? o.video_timestamp_end : null,
        estimated_minutes:
          typeof o.estimated_minutes === "number" ? o.estimated_minutes : 15,
        proof_type: proof.proof_type,
        proof_instructions: proof.proof_instructions,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const { error: insErr } = await supabase.from("plan_steps").insert(inserts);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath(`/dashboard/plans/${planId}`);
  return { ok: true };
}
