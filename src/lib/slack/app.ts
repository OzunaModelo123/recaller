import { App } from "@slack/bolt";
import { VercelReceiver } from "@vercel/slack-bolt";

import {
  evidenceSatisfiesProof,
  normalizeProofType,
} from "@/lib/proof";
import { createAdminClient } from "@/lib/supabase/admin";
import { openSlackBotToken } from "@/lib/slack/bot-token-crypto";
import {
  buildAssignmentMessage,
  buildEvidenceModalBlocks,
  type StepData,
  type AssignmentData,
} from "./blockKit";

/**
 * VercelReceiver reads SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_STATE_SECRET from
 * process.env and auto-creates an OAuth installer. That conflicts with App({ authorize }).
 * OAuth is handled by our /api/slack/install + /api/slack/oauth routes instead.
 */
function createReceiverWithoutAutoOAuth(): VercelReceiver {
  const saved = {
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
    SLACK_STATE_SECRET: process.env.SLACK_STATE_SECRET,
  };
  delete process.env.SLACK_CLIENT_ID;
  delete process.env.SLACK_CLIENT_SECRET;
  delete process.env.SLACK_STATE_SECRET;
  try {
    return new VercelReceiver({
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
    });
  } finally {
    if (saved.SLACK_CLIENT_ID !== undefined)
      process.env.SLACK_CLIENT_ID = saved.SLACK_CLIENT_ID;
    if (saved.SLACK_CLIENT_SECRET !== undefined)
      process.env.SLACK_CLIENT_SECRET = saved.SLACK_CLIENT_SECRET;
    if (saved.SLACK_STATE_SECRET !== undefined)
      process.env.SLACK_STATE_SECRET = saved.SLACK_STATE_SECRET;
  }
}

export const receiver = createReceiverWithoutAutoOAuth();

async function authorizeFromDb({
  teamId,
}: {
  teamId?: string;
  enterpriseId?: string;
  isEnterpriseInstall?: boolean;
}) {
  if (!teamId) {
    throw new Error("Missing teamId — cannot resolve Slack installation");
  }
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("slack_installations")
    .select("bot_token_encrypted, bot_user_id")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error || !data?.bot_token_encrypted) {
    throw new Error(`No Slack installation for team ${teamId}`);
  }
  return {
    botToken: openSlackBotToken(data.bot_token_encrypted),
    botId: data.bot_user_id ?? undefined,
    botUserId: data.bot_user_id ?? undefined,
  };
}

async function orgIdForSlackTeam(teamId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("organisations")
    .select("id")
    .eq("slack_team_id", teamId)
    .maybeSingle();
  return data?.id ?? null;
}

async function findUserBySlackInOrg(
  slackUserId: string,
  orgId: string,
): Promise<{ id: string; full_name: string | null; email: string } | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("users")
    .select("id, full_name, email")
    .eq("slack_user_id", slackUserId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data ?? null;
}

/** Only the assignee's linked Slack user may complete steps (not admins or other members). */
async function assigneeSlackMatchesActor(
  assignedToUserId: string,
  slackActorId: string,
): Promise<boolean> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("users")
    .select("slack_user_id")
    .eq("id", assignedToUserId)
    .maybeSingle();
  if (!data?.slack_user_id) return false;
  return data.slack_user_id === slackActorId;
}

export const app = new App({
  receiver,
  authorize: authorizeFromDb,
  /** Required for Vercel/serverless: createHandler() calls app.init(); Bolt only populates argAuthorize when this is true. */
  deferInitialization: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchAssignmentContext(assignmentId: string) {
  const sb = createAdminClient();

  const { data: assignment } = await sb
    .from("assignments")
    .select("id, assigned_to, plan_id, status, org_id, due_date, assigner_note, plans(title)")
    .eq("id", assignmentId)
    .single();
  if (!assignment) return null;

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

  const { data: userRow } = await sb
    .from("users")
    .select("full_name, email")
    .eq("id", assignment.assigned_to)
    .single();

  const planTitle =
    (assignment as unknown as { plans: { title: string } | null }).plans?.title ??
    "Training Plan";

  const assignmentData: AssignmentData = {
    id: assignment.id,
    planTitle,
    dueDate: assignment.due_date,
    assignerNote: assignment.assigner_note,
  };

  const completedSet = new Set((completions ?? []).map((c) => c.step_number));

  return {
    assignment,
    assignmentData,
    steps: (steps ?? []) as StepData[],
    completedSet,
    employeeName: userRow?.full_name ?? userRow?.email ?? "there",
  };
}

/**
 * Minimal DB work for the "Mark step complete" button. Used so we can ack with
 * `response_action: push` within Slack's 3s window (avoids `views.open` after a slow path).
 */
async function fetchMinimalForCompleteStepButton(
  assignmentId: string,
  stepNumber: number,
  slackTeamId: string,
  slackActorId: string,
): Promise<
  | {
      ok: true;
      orgId: string;
      assigneeId: string;
      assignmentId: string;
      proofType: ReturnType<typeof normalizeProofType>;
      proofInstructions: string;
    }
  | { ok: false }
> {
  const orgFromTeam = await orgIdForSlackTeam(slackTeamId);
  if (!orgFromTeam) return { ok: false };

  const sb = createAdminClient();
  const { data: assignment } = await sb
    .from("assignments")
    .select("id, assigned_to, plan_id, status, org_id")
    .eq("id", assignmentId)
    .eq("org_id", orgFromTeam)
    .maybeSingle();

  if (!assignment || assignment.status === "cancelled") return { ok: false };

  const [{ data: stepRow }, { data: assigneeRow }] = await Promise.all([
    sb
      .from("plan_steps")
      .select("proof_type, proof_instructions")
      .eq("plan_id", assignment.plan_id)
      .eq("step_number", stepNumber)
      .maybeSingle(),
    sb
      .from("users")
      .select("slack_user_id")
      .eq("id", assignment.assigned_to)
      .maybeSingle(),
  ]);

  if (!stepRow) return { ok: false };
  if (assigneeRow?.slack_user_id !== slackActorId) return { ok: false };

  const proofType = normalizeProofType(stepRow.proof_type);
  const proofInstructions =
    typeof stepRow.proof_instructions === "string"
      ? stepRow.proof_instructions
      : "";

  return {
    ok: true,
    orgId: orgFromTeam,
    assigneeId: assignment.assigned_to,
    assignmentId: assignment.id,
    proofType,
    proofInstructions,
  };
}

async function getBotToken(orgId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("slack_installations")
    .select("bot_token_encrypted")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data?.bot_token_encrypted) return null;
  try {
    return openSlackBotToken(data.bot_token_encrypted);
  } catch (e) {
    console.error("[Slack] bot token decrypt failed", e);
    return null;
  }
}

async function callCompletionsApi(
  assignmentId: string,
  stepNumber: number,
  evidence: { text?: string; url?: string; storage_path?: string },
  userId: string,
  orgId: string,
) {
  const sb = createAdminClient();

  const { data: assignment } = await sb
    .from("assignments")
    .select("id, assigned_to, plan_id, status, org_id")
    .eq("id", assignmentId)
    .single();
  if (!assignment || assignment.assigned_to !== userId) return { ok: false, error: "Forbidden" };
  if (assignment.org_id !== orgId) return { ok: false, error: "Forbidden" };
  if (assignment.status === "cancelled") return { ok: false, error: "Assignment cancelled" };

  const { data: stepRow } = await sb
    .from("plan_steps")
    .select("proof_type, proof_instructions")
    .eq("plan_id", assignment.plan_id)
    .eq("step_number", stepNumber)
    .maybeSingle();
  if (!stepRow) return { ok: false, error: "Step not found" };

  const proofType = normalizeProofType(stepRow.proof_type);
  const evidenceJson = {
    text: evidence.text?.trim() || undefined,
    url: evidence.url?.trim() || undefined,
    storage_path: evidence.storage_path?.trim() || undefined,
  };
  if (!evidenceSatisfiesProof(proofType, evidenceJson)) {
    return { ok: false, error: "Evidence does not satisfy proof requirements" };
  }

  const { data: existing } = await sb
    .from("step_completions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("step_number", stepNumber)
    .maybeSingle();
  if (existing) return { ok: false, error: "Already completed" };

  const { error: insErr } = await sb.from("step_completions").insert({
    assignment_id: assignmentId,
    step_number: stepNumber,
    platform_completed_on: "slack",
    evidence: evidenceJson,
  });
  if (insErr) return { ok: false, error: insErr.message };

  const { count: totalSteps } = await sb
    .from("plan_steps")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", assignment.plan_id);

  const { count: doneCount } = await sb
    .from("step_completions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  if (doneCount != null && totalSteps != null && doneCount >= totalSteps && assignment.status === "active") {
    await sb.from("assignments").update({ status: "completed" }).eq("id", assignmentId);
  }

  return { ok: true, completedSteps: doneCount ?? 0, totalSteps: totalSteps ?? 0 };
}

// ---------------------------------------------------------------------------
// Action: complete_step_{n} — button press
// ---------------------------------------------------------------------------

app.action(/^complete_step_\d+$/, async ({ ack, action, body, client }) => {
  type InteractionBody = {
    user: { id: string };
    team?: { id?: string };
    channel?: { id: string };
    message?: { ts: string };
  };
  const bodyTyped = body as InteractionBody;

  try {
    if (action.type !== "button" || !action.value) {
      await ack();
      return;
    }
    const [assignmentId, stepNumStr] = action.value.split(":");
    const stepNumber = parseInt(stepNumStr, 10);

    const teamId = bodyTyped.team?.id;
    if (!teamId) {
      await ack();
      return;
    }

    const slackUserId = bodyTyped.user.id;
    const channelId = bodyTyped.channel?.id;
    const messageTs = bodyTyped.message?.ts;

    const minimal = await fetchMinimalForCompleteStepButton(
      assignmentId,
      stepNumber,
      teamId,
      slackUserId,
    );
    if (!minimal.ok) {
      await ack();
      return;
    }

    if (minimal.proofType !== "none") {
      // Same HTTP response as ack — avoids `views.open` + expired trigger_id on cold/slow runs.
      await ack({
        response_action: "push",
        view: {
          type: "modal",
          callback_id: "evidence_submit",
          private_metadata: JSON.stringify({
            assignmentId: minimal.assignmentId,
            stepNumber,
            userId: minimal.assigneeId,
            orgId: minimal.orgId,
            channelId,
            messageTs,
          }),
          title: {
            type: "plain_text",
            text: `Step ${stepNumber} Evidence`,
          },
          submit: { type: "plain_text", text: "Submit" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: buildEvidenceModalBlocks(
            minimal.proofType,
            minimal.proofInstructions.trim() ||
              "Add the proof requested for this step.",
          ),
        },
      } as never);
      return;
    }

    await ack();

    const result = await callCompletionsApi(
      minimal.assignmentId,
      stepNumber,
      {},
      minimal.assigneeId,
      minimal.orgId,
    );
    if (!result.ok) return;

    const ctx = await fetchAssignmentContext(minimal.assignmentId);
    if (!ctx) return;

    ctx.completedSet.add(stepNumber);
    const token = await getBotToken(ctx.assignment.org_id);
    if (!token) return;

    const sb = createAdminClient();
    if (messageTs && channelId) {
      await client.chat.update({
        token,
        channel: channelId,
        ts: messageTs,
        blocks: buildAssignmentMessage(
          ctx.assignmentData,
          ctx.steps,
          ctx.employeeName,
          ctx.completedSet,
        ),
      });

      await sb
        .from("notifications")
        .update({ slack_message_ts: messageTs })
        .eq("user_id", ctx.assignment.assigned_to)
        .eq("org_id", ctx.assignment.org_id)
        .eq("type", "assignment")
        .contains("payload", { assignmentId: ctx.assignment.id });
    }

    const { notifyAdminSlackChannelOnCompletion } = await import(
      "@/lib/notifications/notify-admin-slack"
    );
    await notifyAdminSlackChannelOnCompletion({
      orgId: minimal.orgId,
      assignmentId: minimal.assignmentId,
      stepNumber,
      platform: "slack",
    });
  } catch (err) {
    console.error("[Slack complete_step]", err);
    try {
      await ack();
    } catch {
      /* already acknowledged */
    }
  }
});

// ---------------------------------------------------------------------------
// Modal submission: evidence_submit
// ---------------------------------------------------------------------------

app.view("evidence_submit", async ({ ack, view, client, body }) => {
  await ack();

  let meta: {
    assignmentId: string;
    stepNumber: number;
    userId: string;
    orgId: string;
    channelId?: string;
    messageTs?: string;
  };
  try {
    meta = JSON.parse(view.private_metadata ?? "{}") as typeof meta;
  } catch {
    return;
  }
  if (!meta.assignmentId || !meta.orgId || !meta.userId) return;

  const slackActorId = (body as { user?: { id?: string } }).user?.id;
  if (!slackActorId) return;

  const evidenceText =
    view.state.values.evidence_text_block?.evidence_text?.value ?? undefined;
  const evidenceUrl =
    view.state.values.evidence_url_block?.evidence_url?.value ?? undefined;

  const ctxPre = await fetchAssignmentContext(meta.assignmentId);
  if (!ctxPre || ctxPre.assignment.org_id !== meta.orgId) return;
  if (ctxPre.assignment.assigned_to !== meta.userId) return;
  const assigneeOk = await assigneeSlackMatchesActor(
    ctxPre.assignment.assigned_to,
    slackActorId,
  );
  if (!assigneeOk) return;

  const result = await callCompletionsApi(
    meta.assignmentId,
    meta.stepNumber,
    { text: evidenceText, url: evidenceUrl },
    meta.userId,
    meta.orgId,
  );
  if (!result.ok) return;

  const ctx = await fetchAssignmentContext(meta.assignmentId);
  if (!ctx) return;

  ctx.completedSet.add(meta.stepNumber);
  const token = await getBotToken(meta.orgId);
  if (!token || !meta.messageTs || !meta.channelId) return;

  await client.chat.update({
    token,
    channel: meta.channelId,
    ts: meta.messageTs,
    blocks: buildAssignmentMessage(
      ctx.assignmentData,
      ctx.steps,
      ctx.employeeName,
      ctx.completedSet,
    ),
  });

  const { notifyAdminSlackChannelOnCompletion } = await import(
    "@/lib/notifications/notify-admin-slack"
  );
  await notifyAdminSlackChannelOnCompletion({
    orgId: meta.orgId,
    assignmentId: meta.assignmentId,
    stepNumber: meta.stepNumber,
    platform: "slack",
  });
});

// ---------------------------------------------------------------------------
// Slash command: /recaller-status
// ---------------------------------------------------------------------------

app.command("/recaller-status", async ({ ack, command, respond }) => {
  await ack();

  const teamId = command.team_id;
  if (!teamId) {
    await respond({
      text: "Could not determine workspace.",
      response_type: "ephemeral",
    });
    return;
  }
  const orgId = await orgIdForSlackTeam(teamId);
  if (!orgId) {
    await respond({
      text: "This workspace is not connected to Recaller.",
      response_type: "ephemeral",
    });
    return;
  }

  const recallerUser = await findUserBySlackInOrg(command.user_id, orgId);

  if (!recallerUser) {
    await respond({
      text:
        "Your Slack account isn't linked to Recaller yet. In the web app, open *My Plans* and use *Link Slack* (same email as Slack). Your admin must connect the workspace in Settings first.",
      response_type: "ephemeral",
    });
    return;
  }

  const sb = createAdminClient();
  const { data: assignments } = await sb
    .from("assignments")
    .select("id, status, plan_id, due_date, plans(title)")
    .eq("assigned_to", recallerUser.id)
    .eq("org_id", orgId)
    .eq("status", "active");

  if (!assignments || assignments.length === 0) {
    await respond({
      text: ":white_check_mark: You have no active training plans right now. Nice work!",
      response_type: "ephemeral",
    });
    return;
  }

  const lines: string[] = [];
  for (const a of assignments) {
    const planTitle =
      (a as unknown as { plans: { title: string } | null }).plans?.title ?? "Plan";
    const { count: totalSteps } = await sb
      .from("plan_steps")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", a.plan_id);
    const { count: doneCount } = await sb
      .from("step_completions")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", a.id);
    const due = a.due_date
      ? ` — due ${new Date(a.due_date).toLocaleDateString()}`
      : "";
    lines.push(
      `• *${planTitle}*: ${doneCount ?? 0}/${totalSteps ?? "?"} steps${due}`,
    );
  }

  await respond({
    text: `:clipboard: *Your active plans:*\n\n${lines.join("\n")}`,
    response_type: "ephemeral",
  });
});

// ---------------------------------------------------------------------------
// Slash command: /recaller-team (admin-gated)
// ---------------------------------------------------------------------------

app.command("/recaller-team", async ({ ack, command, respond }) => {
  await ack();

  const teamId = command.team_id;
  if (!teamId) {
    await respond({
      text: "Could not determine workspace.",
      response_type: "ephemeral",
    });
    return;
  }
  const orgId = await orgIdForSlackTeam(teamId);
  if (!orgId) {
    await respond({
      text: "This workspace is not connected to Recaller.",
      response_type: "ephemeral",
    });
    return;
  }

  const sb = createAdminClient();
  const { data: recallerUser } = await sb
    .from("users")
    .select("id, role, org_id")
    .eq("slack_user_id", command.user_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!recallerUser || !["admin", "super_admin"].includes(recallerUser.role)) {
    await respond({
      text: "This command is restricted to Recaller admins.",
      response_type: "ephemeral",
    });
    return;
  }

  const { count: totalActive } = await sb
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", recallerUser.org_id)
    .eq("status", "active");

  const { count: totalCompleted } = await sb
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", recallerUser.org_id)
    .eq("status", "completed");

  const { count: memberCount } = await sb
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("org_id", recallerUser.org_id);

  await respond({
    text: [
      `:bar_chart: *Team Summary*`,
      `• Active assignments: ${totalActive ?? 0}`,
      `• Completed assignments: ${totalCompleted ?? 0}`,
      `• Team members: ${memberCount ?? 0}`,
    ].join("\n"),
    response_type: "ephemeral",
  });
});

// ---------------------------------------------------------------------------
// Event: app_home_opened
// ---------------------------------------------------------------------------

app.event("app_home_opened", async ({ event, client, context }) => {
  const teamId =
    context.teamId ?? (event as { team?: string; team_id?: string }).team ?? (event as { team_id?: string }).team_id;
  if (!teamId) return;

  const orgId = await orgIdForSlackTeam(teamId);
  if (!orgId) return;

  const recallerUser = await findUserBySlackInOrg(event.user, orgId);

  if (!recallerUser) {
    await client.views.publish({
      user_id: event.user,
      view: {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":wave: Your Slack account isn't linked to Recaller yet. In the web app, go to *My Plans* and tap *Link Slack* (use the same email as in Slack). An admin must connect the workspace in Recaller Settings first.",
            },
          },
        ],
      },
    });
    return;
  }

  const token = await getBotToken(orgId);

  const sb = createAdminClient();
  const { data: assignments } = await sb
    .from("assignments")
    .select("id, status, plan_id, due_date, plans(title)")
    .eq("assigned_to", recallerUser.id)
    .eq("org_id", orgId)
    .eq("status", "active");

  const lines =
    assignments && assignments.length > 0
      ? assignments.map((a) => {
          const planTitle =
            (a as unknown as { plans: { title: string } | null }).plans?.title ?? "Plan";
          return `• *${planTitle}*${a.due_date ? ` — due ${new Date(a.due_date).toLocaleDateString()}` : ""}`;
        })
      : ["_No active plans — you're all caught up!_"];

  await client.views.publish({
    token: token ?? undefined,
    user_id: event.user,
    view: {
      type: "home",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Recaller" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Hi ${recallerUser.full_name ?? "there"}! Here are your active training plans:`,
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: { type: "mrkdwn", text: lines.join("\n") },
        },
      ],
    },
  });
});
