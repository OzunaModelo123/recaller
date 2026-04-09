/**
 * Adaptive Card builders for Microsoft Teams bot messages.
 * Cards follow the Adaptive Card schema v1.5.
 */

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

type AdaptiveCardElement = Record<string, unknown>;
type AdaptiveCard = {
  type: "AdaptiveCard";
  $schema: string;
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardElement[];
};

function stepContainer(
  step: StepData,
  assignment: AssignmentData,
  completed: boolean,
): AdaptiveCardElement[] {
  const proofLine =
    step.proof_type !== "none"
      ? `\n\n_Proof (${step.proof_type}): ${step.proof_instructions}_`
      : "";
  const timeLine =
    step.estimated_minutes != null
      ? `\n\n_Estimated: ${step.estimated_minutes} min_`
      : "";

  if (completed) {
    return [
      {
        type: "TextBlock",
        text: `\\u2705 Step ${step.step_number}: ${step.title} — Completed`,
        weight: "Bolder",
        wrap: true,
        color: "Good",
      },
    ];
  }

  const requiresEvidence = step.proof_type !== "none";

  const elements: AdaptiveCardElement[] = [
    {
      type: "TextBlock",
      text: `Step ${step.step_number}: ${step.title}`,
      weight: "Bolder",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: step.instructions,
      wrap: true,
    },
    {
      type: "TextBlock",
      text: `Success criteria: ${step.success_criteria}${proofLine}${timeLine}`,
      isSubtle: true,
      wrap: true,
      size: "Small",
    },
  ];

  if (requiresEvidence) {
    if (["text", "text_and_link"].includes(step.proof_type)) {
      elements.push({
        type: "Input.Text",
        id: `evidence_text_${step.step_number}`,
        placeholder: "Describe what you did...",
        isMultiline: true,
        label: "Your response",
      });
    }
    if (["link", "text_and_link"].includes(step.proof_type)) {
      elements.push({
        type: "Input.Text",
        id: `evidence_url_${step.step_number}`,
        placeholder: "https://...",
        label: "Link",
      });
    }
    if (["file", "screenshot"].includes(step.proof_type)) {
      elements.push({
        type: "Input.Text",
        id: `evidence_url_${step.step_number}`,
        placeholder: "https://... (link to file or screenshot)",
        label: "Link",
      });
      elements.push({
        type: "Input.Text",
        id: `evidence_text_${step.step_number}`,
        placeholder: "Optional: describe what you shared or add context...",
        isMultiline: true,
        label: "Notes",
      });
    }
  }

  elements.push({
    type: "ActionSet",
    actions: [
      {
        type: "Action.Submit",
        title: `Mark Step ${step.step_number} Complete`,
        style: "positive",
        data: {
          action: "complete_step",
          assignmentId: assignment.id,
          stepNumber: step.step_number,
          ...(requiresEvidence
            ? { evidenceFields: true }
            : {}),
        },
      },
    ],
  });

  return elements;
}

export function buildAssignmentCard(
  assignment: AssignmentData,
  steps: StepData[],
  employeeName: string,
  completedStepNumbers: Set<number> = new Set(),
): AdaptiveCard {
  const allDone = steps.every((s) => completedStepNumbers.has(s.step_number));

  const body: AdaptiveCardElement[] = [
    {
      type: "TextBlock",
      text: allDone
        ? `Training Plan Complete: ${assignment.planTitle}`
        : `New Training Plan: ${assignment.planTitle}`,
      size: "Large",
      weight: "Bolder",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: allDone
        ? `\\ud83c\\udf89 Great work, ${employeeName}! You've completed all ${steps.length} steps.`
        : `Hi ${employeeName}! You've been assigned a new execution plan. Complete these ${steps.length} steps to put your training into practice.`,
      wrap: true,
    },
  ];

  if (assignment.assignerNote) {
    body.push({
      type: "TextBlock",
      text: `> _${assignment.assignerNote}_`,
      wrap: true,
      isSubtle: true,
    });
  }

  body.push({
    type: "TextBlock",
    text: " ",
    separator: true,
  });

  for (const step of steps) {
    body.push(
      {
        type: "Container",
        items: stepContainer(
          step,
          assignment,
          completedStepNumbers.has(step.step_number),
        ),
        separator: true,
      },
    );
  }

  const contextParts: string[] = [];
  if (assignment.dueDate) {
    contextParts.push(`Due: ${new Date(assignment.dueDate).toLocaleDateString()}`);
  }
  const doneCount = completedStepNumbers.size;
  contextParts.push(`Progress: ${doneCount}/${steps.length} steps`);

  body.push({
    type: "TextBlock",
    text: contextParts.join(" | "),
    isSubtle: true,
    size: "Small",
    separator: true,
  });

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body,
  };
}

export function buildNudgeCard(
  assignment: AssignmentData,
  currentStep: StepData,
): AdaptiveCard {
  const proofLine =
    currentStep.proof_type !== "none"
      ? `\n\n_Proof (${currentStep.proof_type}): ${currentStep.proof_instructions}_`
      : "";

  const requiresEvidence = currentStep.proof_type !== "none";

  const body: AdaptiveCardElement[] = [
    {
      type: "TextBlock",
      text: `\\ud83d\\udc4b Reminder — ${assignment.planTitle}`,
      weight: "Bolder",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: `Step ${currentStep.step_number}: ${currentStep.title}`,
      weight: "Bolder",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: `${currentStep.instructions}\n\nSuccess criteria: ${currentStep.success_criteria}${proofLine}`,
      wrap: true,
    },
  ];

  if (requiresEvidence) {
    if (["text", "text_and_link"].includes(currentStep.proof_type)) {
      body.push({
        type: "Input.Text",
        id: `evidence_text_${currentStep.step_number}`,
        placeholder: "Describe what you did...",
        isMultiline: true,
        label: "Your response",
      });
    }
    if (["link", "text_and_link"].includes(currentStep.proof_type)) {
      body.push({
        type: "Input.Text",
        id: `evidence_url_${currentStep.step_number}`,
        placeholder: "https://...",
        label: "Link",
      });
    }
    if (["file", "screenshot"].includes(currentStep.proof_type)) {
      body.push({
        type: "Input.Text",
        id: `evidence_text_${currentStep.step_number}`,
        placeholder: "Paste a link to your file/screenshot, or describe what you did...",
        isMultiline: true,
        label: "Evidence",
      });
    }
  }

  body.push({
    type: "ActionSet",
    actions: [
      {
        type: "Action.Submit",
        title: `Mark Step ${currentStep.step_number} Complete`,
        style: "positive",
        data: {
          action: "complete_step",
          assignmentId: assignment.id,
          stepNumber: currentStep.step_number,
          ...(requiresEvidence ? { evidenceFields: true } : {}),
        },
      },
    ],
  });

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body,
  };
}

export function buildWeeklyDigestCard(digest: DigestPayload): AdaptiveCard {
  const topList = digest.topCompletions
    .map((t, i) => `${i + 1}. ${t.name} — ${t.count} steps`)
    .join("\n");

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: `Weekly Digest: ${digest.orgName}`,
        size: "Large",
        weight: "Bolder",
        wrap: true,
      },
      {
        type: "FactSet",
        facts: [
          { title: "Total Assignments", value: String(digest.totalAssignments) },
          { title: "Completed This Week", value: String(digest.completedThisWeek) },
          { title: "Active Employees", value: String(digest.activeEmployees) },
        ],
      },
      {
        type: "TextBlock",
        text: topList
          ? `**Top Completions**\n${topList}`
          : "_No completions this week._",
        wrap: true,
        separator: true,
      },
    ],
  };
}

export function buildAdminCompletionNotice(opts: {
  employeeName: string;
  planTitle: string;
  stepNumber: number;
  totalSteps: number;
  percentRounded: number;
  platform: "slack" | "web" | "teams";
}): AdaptiveCard {
  const via =
    opts.platform === "slack"
      ? "Slack"
      : opts.platform === "teams"
        ? "Teams"
        : "web";

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: `\\u2705 ${opts.employeeName} completed Step ${opts.stepNumber} of ${opts.totalSteps} on **${opts.planTitle}** — ${opts.percentRounded}% (${via})`,
        wrap: true,
      },
    ],
  };
}
