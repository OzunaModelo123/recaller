// Evidence is readable by org admins via existing step_completions_select_org_scope (Phase 5 manager UI).
import { NextResponse } from "next/server";

import {
  evidenceSatisfiesProof,
  normalizeProofType,
  type StepEvidence,
} from "@/lib/proof";
import { createClient } from "@/lib/supabase/server";
import {
  logPostgrestError,
  sanitizedPostgrestError,
} from "@/lib/supabase/sanitized-error";
import type { Json } from "@/types/database";
import { notifyAdminSlackChannelOnCompletion } from "@/lib/notifications/notify-admin-slack";
import { refreshSlackAssignmentDmAfterWebCompletion } from "@/lib/notifications/notify-employee-slack-assignment";
import { refreshTeamsAssignmentCardAfterWebCompletion } from "@/lib/notifications/notify-employee-teams-assignment";

export const runtime = "nodejs";

type Body = {
  assignmentId?: string;
  stepNumber?: number;
  platform?: "web" | "slack" | "teams";
  note?: string;
  difficultyRating?: number;
  evidence?: StepEvidence;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assignmentId = body.assignmentId?.trim();
  const stepRaw = body.stepNumber;
  const stepNumber =
    typeof stepRaw === "number"
      ? stepRaw
      : typeof stepRaw === "string"
        ? Number.parseInt(stepRaw, 10)
        : NaN;
  const platform = body.platform ?? "web";
  if (
    !assignmentId ||
    !Number.isInteger(stepNumber) ||
    stepNumber < 1 ||
    stepNumber > 10
  ) {
    return NextResponse.json(
      {
        error:
          "assignmentId and a valid stepNumber (integer 1–10) are required",
      },
      { status: 400 },
    );
  }
  if (!["web", "slack", "teams"].includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .select("id, assigned_to, plan_id, status, org_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (aErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  if (assignment.assigned_to !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (assignment.status === "cancelled") {
    return NextResponse.json({ error: "Assignment cancelled" }, { status: 400 });
  }

  const { data: stepRow, error: sErr } = await supabase
    .from("plan_steps")
    .select("proof_type, proof_instructions")
    .eq("plan_id", assignment.plan_id)
    .eq("step_number", stepNumber)
    .maybeSingle();

  if (sErr || !stepRow) {
    return NextResponse.json({ error: "Step not found for this plan" }, { status: 400 });
  }

  const proofType = normalizeProofType(stepRow.proof_type);
  const evidence: StepEvidence = {
    text: body.evidence?.text,
    url: body.evidence?.url,
    storage_path: body.evidence?.storage_path,
  };

  if (!evidenceSatisfiesProof(proofType, evidence)) {
    return NextResponse.json(
      {
        error:
          "Evidence does not satisfy this step's proof requirements. Check proof type and instructions.",
      },
      { status: 400 },
    );
  }

  const evidenceJson = {
    text: evidence.text?.trim() || undefined,
    url: evidence.url?.trim() || undefined,
    storage_path: evidence.storage_path?.trim() || undefined,
  } satisfies Record<string, unknown>;

  const { data: existing } = await supabase
    .from("step_completions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("step_number", stepNumber)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This step is already marked complete" },
      { status: 409 },
    );
  }

  const { error: insErr } = await supabase.from("step_completions").insert({
    assignment_id: assignmentId,
    step_number: stepNumber,
    note: body.note?.trim() || null,
    difficulty_rating:
      typeof body.difficultyRating === "number" &&
      body.difficultyRating >= 1 &&
      body.difficultyRating <= 5
        ? body.difficultyRating
        : null,
    platform_completed_on: platform,
    evidence: evidenceJson as Json,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { error: "This step is already marked complete" },
        { status: 409 },
      );
    }
    logPostgrestError("api/completions insert", insErr);
    return NextResponse.json(
      { error: sanitizedPostgrestError(insErr) },
      { status: 500 },
    );
  }

  const { count: totalSteps, error: tsErr } = await supabase
    .from("plan_steps")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", assignment.plan_id);

  if (tsErr || totalSteps == null) {
    return NextResponse.json(
      { error: "Could not count plan steps" },
      { status: 500 },
    );
  }

  const { count: doneCount, error: dcErr } = await supabase
    .from("step_completions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  if (dcErr || doneCount == null) {
    return NextResponse.json(
      { error: "Could not count completions" },
      { status: 500 },
    );
  }

  let assignmentStatus = assignment.status;
  if (doneCount >= totalSteps && assignment.status === "active") {
    const { error: upErr } = await supabase
      .from("assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);
    if (!upErr) assignmentStatus = "completed";
  }

  try {
    await notifyAdminSlackChannelOnCompletion({
      orgId: assignment.org_id,
      assignmentId,
      stepNumber,
      platform,
    });
  } catch (e) {
    console.error("[completions] Admin Slack notify failed", e);
  }

  if (platform === "web") {
    try {
      await refreshSlackAssignmentDmAfterWebCompletion({
        orgId: assignment.org_id,
        assignmentId,
        assigneeUserId: user.id,
      });
    } catch (e) {
      console.error("[completions] Slack DM refresh failed", e);
    }
    try {
      await refreshTeamsAssignmentCardAfterWebCompletion({
        orgId: assignment.org_id,
        assignmentId,
        assigneeUserId: user.id,
      });
    } catch (e) {
      console.error("[completions] Teams card refresh failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    assignmentStatus,
    completedSteps: doneCount,
    totalSteps,
    justCompleted: true,
  });
}
