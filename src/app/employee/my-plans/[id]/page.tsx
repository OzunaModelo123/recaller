import { notFound, redirect } from "next/navigation";

import { defaultProofForStep, normalizeProofType } from "@/lib/proof";
import { createClient } from "@/lib/supabase/server";

import { AssignmentStepFlow, type EmployeePlanStep } from "../assignment-step-flow";

type Props = { params: Promise<{ id: string }> };

export default async function EmployeeAssignmentPage({ params }: Props) {
  const { id: assignmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .select("id, assigned_to, plan_id, status, assigner_note, require_content_consumption, content_consumed")
    .eq("id", assignmentId)
    .maybeSingle();

  if (aErr || !assignment || assignment.assigned_to !== user.id) {
    notFound();
  }

  const { data: plan, error: pErr } = await supabase
    .from("plans")
    .select("title, content_item_id")
    .eq("id", assignment.plan_id)
    .maybeSingle();

  if (pErr || !plan) notFound();

  const { data: stepRows } = await supabase
    .from("plan_steps")
    .select(
      "step_number, title, instructions, success_criteria, video_timestamp_start, video_timestamp_end, estimated_minutes, proof_type, proof_instructions",
    )
    .eq("plan_id", assignment.plan_id)
    .order("step_number", { ascending: true });

  const { data: completionRows } = await supabase
    .from("step_completions")
    .select("step_number")
    .eq("assignment_id", assignmentId);

  let videoWatchBaseUrl: string | null = null;
  let sourceType: string | null = null;
  let transcript: string | null = null;

  if (plan.content_item_id) {
    const { data: ci } = await supabase
      .from("content_items")
      .select("source_url, source_type, file_path, transcript")
      .eq("id", plan.content_item_id)
      .maybeSingle();

    if (ci) {
      if (ci.source_type === "mp4" || ci.source_type === "mp3") {
         if (ci.file_path) {
            const { data: pubUrl } = supabase.storage.from("content-files").getPublicUrl(ci.file_path);
            videoWatchBaseUrl = pubUrl.publicUrl;
         }
      } else if (ci.source_url?.trim()) {
         videoWatchBaseUrl = ci.source_url.trim();
      }
      sourceType = ci.source_type;
      transcript = ci.transcript;
    }
  }

  const steps: EmployeePlanStep[] = (stepRows ?? []).map((s) => {
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
      proof_type: normalizeProofType(proof.proof_type),
      proof_instructions: proof.proof_instructions,
    };
  });

  const initialCompleted = (completionRows ?? []).map((c) => c.step_number);

  if (steps.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This plan has no steps yet. Contact your admin.
      </div>
    );
  }

  return (
    <AssignmentStepFlow
      assignmentId={assignment.id}
      planTitle={plan.title}
      steps={steps}
      initialCompleted={initialCompleted}
      videoWatchBaseUrl={videoWatchBaseUrl}
      assignerNote={assignment.assigner_note}
      requireContentConsumption={assignment.require_content_consumption}
      contentConsumed={assignment.content_consumed}
      sourceType={sourceType}
      transcript={transcript}
    />
  );
}
