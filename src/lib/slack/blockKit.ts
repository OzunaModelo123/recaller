import type { KnownBlock, Block } from "@slack/web-api";

export type StepData = {
  step_number: number;
  title: string;
  instructions: string;
  success_criteria: string;
  proof_type: string;
  proof_instructions: string;
  estimated_minutes: number | null;
};

export type AssignmentData = {
  id: string;
  planTitle: string;
  dueDate: string | null;
  assignerNote: string | null;
};

export type DigestPayload = {
  orgName: string;
  totalAssignments: number;
  completedThisWeek: number;
  activeEmployees: number;
  topCompletions: { name: string; count: number }[];
};

function stepBlock(
  step: StepData,
  assignment: AssignmentData,
  completed: boolean,
): (KnownBlock | Block)[] {
  const proofLine =
    step.proof_type !== "none"
      ? `\n_Proof (${step.proof_type}): ${step.proof_instructions}_`
      : "";
  const timeLine =
    step.estimated_minutes != null
      ? `\n_Estimated: ${step.estimated_minutes} min_`
      : "";

  const text = completed
    ? `:white_check_mark: *Step ${step.step_number}: ${step.title}* — Completed`
    : `*Step ${step.step_number}: ${step.title}*\n${step.instructions}\n\n_Success criteria: ${step.success_criteria}_${proofLine}${timeLine}`;

  const blocks: (KnownBlock | Block)[] = [
    { type: "section", text: { type: "mrkdwn", text } },
  ];

  if (!completed) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: `Mark Step ${step.step_number} Complete`,
          },
          style: "primary",
          action_id: `complete_step_${step.step_number}`,
          value: `${assignment.id}:${step.step_number}`,
        },
      ],
    });
  }

  return blocks;
}

export function buildAssignmentMessage(
  assignment: AssignmentData,
  steps: StepData[],
  employeeName: string,
  completedStepNumbers: Set<number> = new Set(),
): (KnownBlock | Block)[] {
  const allDone = steps.every((s) => completedStepNumbers.has(s.step_number));

  const blocks: (KnownBlock | Block)[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: allDone
          ? `Training Plan Complete: ${assignment.planTitle}`
          : `New Training Plan: ${assignment.planTitle}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: allDone
          ? `:tada: Great work, ${employeeName}! You've completed all ${steps.length} steps.`
          : `Hi ${employeeName}! You've been assigned a new execution plan. Complete these ${steps.length} steps to put your training into practice.`,
      },
    },
  ];

  if (assignment.assignerNote) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `> _${assignment.assignerNote}_`,
      },
    });
  }

  blocks.push({ type: "divider" });

  for (const step of steps) {
    blocks.push(
      ...stepBlock(step, assignment, completedStepNumbers.has(step.step_number)),
    );
  }

  const contextParts: string[] = [];
  if (assignment.dueDate) {
    contextParts.push(`Due: ${new Date(assignment.dueDate).toLocaleDateString()}`);
  }
  const doneCount = completedStepNumbers.size;
  contextParts.push(`Progress: ${doneCount}/${steps.length} steps`);

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: contextParts.join(" | ") }],
  });

  return blocks;
}

export function buildNudgeMessage(
  assignment: AssignmentData,
  currentStep: StepData,
): (KnownBlock | Block)[] {
  const proofLine =
    currentStep.proof_type !== "none"
      ? `\n_Proof (${currentStep.proof_type}): ${currentStep.proof_instructions}_`
      : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:wave: Reminder — *${assignment.planTitle}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Step ${currentStep.step_number}: ${currentStep.title}*\n${currentStep.instructions}\n\n_Success criteria: ${currentStep.success_criteria}_${proofLine}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: `Mark Step ${currentStep.step_number} Complete`,
          },
          style: "primary",
          action_id: `complete_step_${currentStep.step_number}`,
          value: `${assignment.id}:${currentStep.step_number}`,
        },
      ],
    },
  ];
}

/** Read-only notice for admin Slack channel (no interactive buttons). */
export function buildAdminCompletionNotice(opts: {
  employeeName: string;
  planTitle: string;
  stepNumber: number;
  totalSteps: number;
  percentRounded: number;
  platform: "slack" | "web" | "teams";
}): (KnownBlock | Block)[] {
  const via =
    opts.platform === "slack"
      ? "Slack"
      : opts.platform === "teams"
        ? "Teams"
        : "web";
  const text = `${opts.employeeName} completed Step ${opts.stepNumber} of ${opts.totalSteps} on *${opts.planTitle}* — ${opts.percentRounded}% (${via})`;
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `:white_check_mark: ${text}` },
    },
  ];
}

export function buildWeeklyDigestMessage(
  digest: DigestPayload,
): (KnownBlock | Block)[] {
  const topList = digest.topCompletions
    .map((t, i) => `${i + 1}. ${t.name} — ${t.count} steps`)
    .join("\n");

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `Weekly Digest: ${digest.orgName}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Total Assignments*\n${digest.totalAssignments}` },
        { type: "mrkdwn", text: `*Completed This Week*\n${digest.completedThisWeek}` },
        { type: "mrkdwn", text: `*Active Employees*\n${digest.activeEmployees}` },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: topList
          ? `*Top Completions*\n${topList}`
          : "_No completions this week._",
      },
    },
  ];
}

export function buildEvidenceModalBlocks(
  proofType: string,
  proofInstructions: string,
): (KnownBlock | Block)[] {
  const blocks: (KnownBlock | Block)[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Proof required (${proofType}):* ${proofInstructions}`,
      },
    },
  ];

  if (["text", "text_and_link"].includes(proofType)) {
    blocks.push({
      type: "input",
      block_id: "evidence_text_block",
      element: {
        type: "plain_text_input",
        action_id: "evidence_text",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "Describe what you did…",
        },
      },
      label: { type: "plain_text", text: "Your response" },
    });
  }

  if (["link", "text_and_link"].includes(proofType)) {
    blocks.push({
      type: "input",
      block_id: "evidence_url_block",
      element: {
        type: "url_text_input",
        action_id: "evidence_url",
        placeholder: {
          type: "plain_text",
          text: "https://…",
        },
      },
      label: { type: "plain_text", text: "Link" },
    });
  }

  if (["file", "screenshot"].includes(proofType)) {
    blocks.push({
      type: "input",
      block_id: "evidence_text_block",
      element: {
        type: "plain_text_input",
        action_id: "evidence_text",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "Paste a link to your file/screenshot, or describe what you did…",
        },
      },
      label: { type: "plain_text", text: "Evidence" },
    });
  }

  const hasInput = blocks.some((b) => "type" in b && b.type === "input");
  if (!hasInput) {
    blocks.push({
      type: "input",
      block_id: "evidence_text_block",
      element: {
        type: "plain_text_input",
        action_id: "evidence_text",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "Describe what you did…",
        },
      },
      label: { type: "plain_text", text: "Your response" },
    });
  }

  return blocks;
}
