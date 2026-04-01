/**
 * Incoming activity handler for Microsoft Teams bot.
 * Receives messages, Adaptive Card action submissions, and conversation updates
 * from the Azure Bot Service.
 */
import { NextResponse } from "next/server";

import { verifyTeamsJwt } from "@/lib/teams/verifyJwt";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evidenceSatisfiesProof,
  normalizeProofType,
} from "@/lib/proof";
import {
  buildAssignmentCard,
  type StepData,
  type AssignmentData,
} from "@/lib/teams/adaptiveCards";
import { getAadUserEmail, reconstructExtEmail } from "@/lib/teams/graphClient";

export const runtime = "nodejs";
export const maxDuration = 30;

type IncomingActivity = {
  type: string;
  name?: string;
  id?: string;
  text?: string;
  from?: { id: string; name?: string; aadObjectId?: string };
  recipient?: { id: string; name?: string };
  conversation?: { id: string; tenantId?: string; conversationType?: string };
  channelId?: string;
  serviceUrl?: string;
  value?: Record<string, unknown>;
  membersAdded?: { id: string; aadObjectId?: string }[];
  channelData?: { tenant?: { id: string } };
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const jwtResult = await verifyTeamsJwt(authHeader);
  if (!jwtResult.valid) {
    return NextResponse.json(
      { error: jwtResult.reason },
      { status: 401 },
    );
  }

  let activity: IncomingActivity;
  try {
    activity = (await request.json()) as IncomingActivity;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const serviceUrl = activity.serviceUrl;
  const tenantId =
    activity.conversation?.tenantId ??
    activity.channelData?.tenant?.id;

  // Auto-link the user on any interaction if they are not yet linked.
  if (activity.from?.id && activity.from.id !== activity.recipient?.id) {
    await tryAutoLinkUser(activity.from.aadObjectId ?? activity.from.id, tenantId).catch(
      (e) => console.warn("[Teams] auto-link failed", e),
    );
  }

  switch (activity.type) {
    case "message":
      return handleMessage(activity);

    case "invoke":
      if (activity.name === "adaptiveCard/action") {
        return handleAdaptiveCardAction(activity);
      }
      return NextResponse.json({ statusCode: 200 }, { status: 200 });

    case "conversationUpdate":
      await handleConversationUpdate(activity, serviceUrl, tenantId);
      return new Response(null, { status: 200 });

    default:
      return new Response(null, { status: 200 });
  }
}

/**
 * Attempts to link a Teams user (by their AAD Object ID) to a Recaller user
 * by looking up their email via Microsoft Graph. Runs silently — never throws.
 */
async function tryAutoLinkUser(
  aadObjectId: string,
  tenantId: string | undefined,
) {
  if (!aadObjectId || !tenantId) return;

  const sb = createAdminClient();

  // Already linked — nothing to do.
  const { data: existing } = await sb
    .from("users")
    .select("id")
    .eq("teams_user_id", aadObjectId)
    .maybeSingle();
  if (existing) return;

  // Find the org for this tenant.
  const { data: org } = await sb
    .from("organisations")
    .select("id")
    .eq("teams_tenant_id", tenantId)
    .maybeSingle();
  if (!org) return;

  // Fetch the AAD profile email via Graph.
  const profile = await getAadUserEmail(aadObjectId);
  if (!profile) return;

  const emailsToTry = new Set<string>();
  for (const raw of [profile.mail, profile.userPrincipalName]) {
    if (!raw) continue;
    const lower = raw.toLowerCase().trim();
    emailsToTry.add(lower);
    const reconstructed = reconstructExtEmail(lower);
    if (reconstructed) emailsToTry.add(reconstructed);
  }

  for (const email of emailsToTry) {
    const { count } = await sb
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .ilike("email", email);

    if ((count ?? 0) > 0) {
      await sb
        .from("users")
        .update({ teams_user_id: aadObjectId })
        .eq("org_id", org.id)
        .ilike("email", email);
      console.log(`[Teams] Auto-linked ${email} → teams_user_id=${aadObjectId}`);
      return;
    }
  }
}

function handleMessage(activity: IncomingActivity) {
  const text = activity.text?.toLowerCase().trim() ?? "";

  let responseText: string;
  if (text.includes("status") || text.includes("plans")) {
    responseText =
      "To check your plan status, use the Recaller web app or wait for your next Adaptive Card assignment. Type **help** for more info.";
  } else {
    responseText =
      "Hi! I'm the Recaller bot. I'll send you training plan assignments as Adaptive Cards — " +
      "you can complete steps right here in Teams. Type **help** for a list of things I can do.";
  }

  return NextResponse.json({
    type: "message",
    text: responseText,
  });
}

async function handleAdaptiveCardAction(activity: IncomingActivity) {
  const actionData = activity.value?.action as Record<string, unknown> | undefined;

  if (!actionData || actionData.action !== "complete_step") {
    return NextResponse.json({
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message",
      value: "Unknown action.",
    });
  }

  const assignmentId = actionData.assignmentId as string | undefined;
  const stepNumber = actionData.stepNumber as number | undefined;
  const hasEvidenceFields = actionData.evidenceFields === true;

  if (!assignmentId || typeof stepNumber !== "number") {
    return NextResponse.json({
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message",
      value: "Invalid action data.",
    });
  }

  const evidenceText = hasEvidenceFields
    ? (activity.value?.[`evidence_text_${stepNumber}`] as string | undefined)
    : undefined;
  const evidenceUrl = hasEvidenceFields
    ? (activity.value?.[`evidence_url_${stepNumber}`] as string | undefined)
    : undefined;

  const teamsUserId =
    activity.from?.aadObjectId ?? activity.from?.id ?? "";
  if (!teamsUserId) {
    return NextResponse.json({
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message",
      value: "Could not identify your Teams account.",
    });
  }

  const result = await completeStepFromTeams(
    assignmentId,
    stepNumber,
    teamsUserId,
    { text: evidenceText, url: evidenceUrl },
  );

  if (!result.ok) {
    return NextResponse.json({
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message",
      value: result.error ?? "Could not complete the step.",
    });
  }

  return NextResponse.json({
    statusCode: 200,
    type: "application/vnd.microsoft.card.adaptive",
    value: result.updatedCard,
  });
}

async function completeStepFromTeams(
  assignmentId: string,
  stepNumber: number,
  teamsUserId: string,
  evidence: { text?: string; url?: string },
): Promise<
  | { ok: true; updatedCard: unknown }
  | { ok: false; error: string }
> {
  const sb = createAdminClient();

  const { data: recallerUser } = await sb
    .from("users")
    .select("id, org_id, full_name, email")
    .eq("teams_user_id", teamsUserId)
    .maybeSingle();

  if (!recallerUser) {
    return { ok: false, error: "Your Teams account is not linked to Recaller. Ask your admin to connect Teams in Settings." };
  }

  const { data: assignment } = await sb
    .from("assignments")
    .select("id, assigned_to, plan_id, status, org_id, due_date, assigner_note, plans(title)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (assignment.assigned_to !== recallerUser.id) {
    return { ok: false, error: "Only the assigned employee can complete steps." };
  }
  if (assignment.org_id !== recallerUser.org_id) {
    return { ok: false, error: "Organization mismatch." };
  }
  if (assignment.status === "cancelled") {
    return { ok: false, error: "This assignment has been cancelled." };
  }

  const { data: stepRow } = await sb
    .from("plan_steps")
    .select("proof_type, proof_instructions")
    .eq("plan_id", assignment.plan_id)
    .eq("step_number", stepNumber)
    .maybeSingle();

  if (!stepRow) return { ok: false, error: "Step not found." };

  const proofType = normalizeProofType(stepRow.proof_type);
  const evidenceJson = {
    text: evidence.text?.trim() || undefined,
    url: evidence.url?.trim() || undefined,
  };

  if (!evidenceSatisfiesProof(proofType, evidenceJson)) {
    return {
      ok: false,
      error: "Please provide the required proof for this step. Check the proof instructions above.",
    };
  }

  const { data: existing } = await sb
    .from("step_completions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("step_number", stepNumber)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "This step is already completed." };
  }

  const { error: insErr } = await sb.from("step_completions").insert({
    assignment_id: assignmentId,
    step_number: stepNumber,
    platform_completed_on: "teams",
    evidence: evidenceJson,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, error: "This step is already completed." };
    }
    return { ok: false, error: insErr.message };
  }

  const { count: totalSteps } = await sb
    .from("plan_steps")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", assignment.plan_id);

  const { count: doneCount } = await sb
    .from("step_completions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  if (
    doneCount != null &&
    totalSteps != null &&
    doneCount >= totalSteps &&
    assignment.status === "active"
  ) {
    await sb
      .from("assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);
  }

  const { data: steps } = await sb
    .from("plan_steps")
    .select(
      "step_number, title, instructions, success_criteria, proof_type, proof_instructions, estimated_minutes",
    )
    .eq("plan_id", assignment.plan_id)
    .order("step_number", { ascending: true });

  const { data: completions } = await sb
    .from("step_completions")
    .select("step_number")
    .eq("assignment_id", assignmentId);

  const planTitle =
    (assignment as unknown as { plans: { title: string } | null }).plans?.title ??
    "Training Plan";

  const completedSet = new Set(
    (completions ?? []).map((c) => c.step_number),
  );
  const employeeName =
    recallerUser.full_name ?? recallerUser.email?.split("@")[0] ?? "there";

  const assignmentData: AssignmentData = {
    id: assignment.id,
    planTitle,
    dueDate: assignment.due_date,
    assignerNote: assignment.assigner_note,
  };

  const updatedCard = buildAssignmentCard(
    assignmentData,
    (steps ?? []) as StepData[],
    employeeName,
    completedSet,
  );

  const { notifyAdminSlackChannelOnCompletion } = await import(
    "@/lib/notifications/notify-admin-slack"
  );
  await notifyAdminSlackChannelOnCompletion({
    orgId: assignment.org_id,
    assignmentId,
    stepNumber,
    platform: "teams",
  }).catch((e: unknown) => {
    console.error("[Teams] admin Slack notify failed", e);
  });

  return { ok: true, updatedCard };
}

async function handleConversationUpdate(
  activity: IncomingActivity,
  serviceUrl: string | undefined,
  tenantId: string | undefined,
) {
  if (!serviceUrl || !tenantId) return;

  const botId = process.env.TEAMS_APP_ID;
  const membersAdded = activity.membersAdded ?? [];

  const botWasAdded = membersAdded.some(
    (m) => m.id === botId || m.id === activity.recipient?.id,
  );

  if (!botWasAdded) return;

  const sb = createAdminClient();

  const { data: org } = await sb
    .from("organisations")
    .select("id")
    .eq("teams_tenant_id", tenantId)
    .maybeSingle();

  if (!org) {
    console.log(
      `[Teams] conversationUpdate: no org found for tenant ${tenantId}`,
    );
    return;
  }

  await sb
    .from("teams_installations")
    .upsert(
      {
        org_id: org.id,
        tenant_id: tenantId,
        bot_id: botId ?? "",
        bot_password_encrypted: "",
        service_url: serviceUrl,
      },
      { onConflict: "org_id" },
    );
}
