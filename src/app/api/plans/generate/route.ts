import { NextResponse } from "next/server";

import { analyzeContent } from "@/lib/ai/contentAnalyzer";
import {
  contentItemHasEmbeddings,
  embedContentItem,
  findSimilarApprovedPlans,
} from "@/lib/ai/embeddingService";
import { orgContextIsEmpty, parseOrgContext } from "@/lib/ai/orgContext";
import { generatePlan } from "@/lib/ai/planGenerator";
import { validatePlan } from "@/lib/ai/planValidator";
import { cleanTranscript } from "@/lib/ai/transcriptCleaner";
import { purgeContentSourceFile } from "@/lib/content/purgeContentSourceFile";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type NdjsonLine =
  | { type: "progress"; stage: string; detail?: string }
  | {
      type: "complete";
      planId: string;
      validation: unknown;
      validationWarning: boolean;
      orgContextIncomplete: boolean;
    }
  | { type: "error"; message: string };

function encodeLine(line: NdjsonLine): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(line)}\n`);
}

export async function POST(request: Request) {
  let body: { contentItemId?: string; targetRole?: string };
  try {
    body = (await request.json()) as { contentItemId?: string; targetRole?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentItemId = body.contentItemId?.trim();
  if (!contentItemId) {
    return NextResponse.json({ error: "contentItemId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profErr } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (profErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = profile.org_id;

  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .select("org_context, onboarding_completed")
    .eq("id", orgId)
    .single();

  if (orgErr || !org) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 400 });
  }

  const { data: item, error: itemErr } = await supabase
    .from("content_items")
    .select("id, org_id, transcript, status")
    .eq("id", contentItemId)
    .maybeSingle();

  if (itemErr || !item) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }
  if (item.org_id !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (item.status !== "ready") {
    return NextResponse.json(
      { error: "Content must be ready before generating a plan" },
      { status: 400 },
    );
  }
  const rawTranscript = item.transcript?.trim();
  if (!rawTranscript) {
    return NextResponse.json(
      { error: "Transcript is required to generate a plan" },
      { status: 400 },
    );
  }

  const orgContext = parseOrgContext(org.org_context);

  let targetRole = body.targetRole?.trim();
  if (!targetRole && orgContext.roles.length > 0) {
    targetRole = orgContext.roles[0]!.name;
  }
  if (!targetRole) {
    targetRole = "All roles";
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (line: NdjsonLine) => controller.enqueue(encodeLine(line));

      try {
        push({ type: "progress", stage: "analyzing", detail: "Analyzing content…" });
        const cleaned = cleanTranscript(rawTranscript);
        const analysis = await analyzeContent(cleaned, orgContext);

        push({
          type: "progress",
          stage: "generating",
          detail: `Generating plan for ${targetRole}…`,
        });
        const similar = await findSimilarApprovedPlans(
          supabase,
          analysis.summary || cleaned.slice(0, 2000),
          orgId,
          3,
        );

        let plan = await generatePlan(
          cleaned,
          analysis,
          orgContext,
          targetRole,
          similar,
        );
        push({ type: "progress", stage: "validating", detail: "Validating quality…" });
        let validation = await validatePlan(plan, orgContext, analysis);

        let feedback: string | undefined;
        for (let retry = 0; retry < 2 && !validation.pass; retry++) {
          feedback = validation.feedback;
          push({
            type: "progress",
            stage: "generating",
            detail: "Refining plan from validation feedback…",
          });
          plan = await generatePlan(
            cleaned,
            analysis,
            orgContext,
            targetRole,
            similar,
            { priorValidationFeedback: feedback },
          );
          push({ type: "progress", stage: "validating", detail: "Validating quality…" });
          validation = await validatePlan(plan, orgContext, analysis);
        }

        const validationWarning = !validation.pass;

        const currentVersion = {
          title: plan.title,
          category: plan.category,
          complexity: plan.complexity,
          skill_level: plan.skill_level,
          target_role: plan.target_role,
          steps: plan.steps.map((s) => ({
            step_number: s.step_number,
            title: s.title,
            instructions: s.instructions,
            success_criteria: s.success_criteria,
            video_timestamp_start: s.video_timestamp_start,
            video_timestamp_end: s.video_timestamp_end,
            estimated_minutes: s.estimated_minutes,
            proof_type: s.proof_type,
            proof_instructions: s.proof_instructions,
          })),
        };

        const { data: inserted, error: insPlanErr } = await supabase
          .from("plans")
          .insert({
            org_id: orgId,
            content_item_id: contentItemId,
            created_by: user.id,
            title: plan.title,
            original_ai_draft: currentVersion,
            current_version: currentVersion,
            content_analysis: analysis,
            quality_scores: validation,
            category: plan.category,
            complexity: plan.complexity,
            skill_level: plan.skill_level,
            target_role: targetRole,
            is_template: false,
          })
          .select("id")
          .single();

        if (insPlanErr || !inserted) {
          throw new Error(insPlanErr?.message ?? "Failed to save plan");
        }

        const planId = inserted.id;

        const stepRows = plan.steps.map((s) => ({
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

        const { error: stepsErr } = await supabase.from("plan_steps").insert(stepRows);
        if (stepsErr) {
          await supabase.from("plans").delete().eq("id", planId);
          throw new Error(stepsErr.message);
        }

        push({ type: "progress", stage: "embedding", detail: "Indexing content…" });
        const hasEmb = await contentItemHasEmbeddings(contentItemId);
        if (!hasEmb) {
          await embedContentItem(contentItemId, orgId);
        }

        try {
          await purgeContentSourceFile(supabase, contentItemId);
        } catch (purgeErr) {
          console.error("[plans/generate] purge source file", contentItemId, purgeErr);
        }

        push({
          type: "complete",
          planId,
          validation,
          validationWarning,
          orgContextIncomplete: orgContextIsEmpty(orgContext),
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Plan generation failed";
        push({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
