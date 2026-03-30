import type { ContentAnalysis } from "./contentAnalyzer";
import type { SimilarPlan } from "./embeddingService";
import type { OrgContext } from "./orgContext";
import { getRoleDetails } from "./orgContext";
import { GENERATION_MODEL, aiClient } from "./modelRouter";

export type GeneratedPlanStep = {
  step_number: number;
  title: string;
  instructions: string;
  success_criteria: string;
  video_timestamp_start: number | null;
  video_timestamp_end: number | null;
  estimated_minutes: number;
};

export type GeneratedPlan = {
  title: string;
  category: string;
  complexity: string;
  skill_level: string;
  target_role: string;
  steps: GeneratedPlanStep[];
};

const generatedPlanJsonSchema = {
  name: "generated_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "category",
      "complexity",
      "skill_level",
      "target_role",
      "steps",
    ],
    properties: {
      title: { type: "string" },
      category: { type: "string" },
      complexity: { type: "string" },
      skill_level: { type: "string" },
      target_role: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "step_number",
            "title",
            "instructions",
            "success_criteria",
            "video_timestamp_start",
            "video_timestamp_end",
            "estimated_minutes",
          ],
          properties: {
            step_number: { type: "integer" },
            title: { type: "string" },
            instructions: { type: "string" },
            success_criteria: { type: "string" },
            video_timestamp_start: { type: "integer" },
            video_timestamp_end: { type: "integer" },
            estimated_minutes: { type: "integer" },
          },
        },
      },
    },
  },
} as const;

function normalizePlan(raw: GeneratedPlan): GeneratedPlan {
  const sorted = raw.steps
    .filter((s) => s.step_number >= 1 && s.step_number <= 20)
    .sort((a, b) => a.step_number - b.step_number);

  const steps = sorted.map((s, idx) => ({
    ...s,
    step_number: idx + 1,
    video_timestamp_start:
      s.video_timestamp_start && s.video_timestamp_start > 0
        ? s.video_timestamp_start
        : null,
    video_timestamp_end:
      s.video_timestamp_end && s.video_timestamp_end > 0
        ? s.video_timestamp_end
        : null,
    estimated_minutes: Math.max(5, s.estimated_minutes || 15),
  }));

  const clamped = steps.slice(0, 10);
  if (clamped.length < 2) {
    throw new Error("Generated plan must include between 2 and 10 steps");
  }
  return { ...raw, steps: clamped };
}

export async function generatePlan(
  transcript: string,
  analysis: ContentAnalysis,
  orgContext: OrgContext,
  targetRole: string,
  similarPlans: SimilarPlan[],
  options?: { priorValidationFeedback?: string },
): Promise<GeneratedPlan> {
  const role = getRoleDetails(orgContext, targetRole);
  const typicalDay =
    role?.typical_day ||
    "Typical professional workday with meetings and focused work.";
  const toolList = role?.tools ?? [];
  const tools =
    toolList.length > 0 ? toolList.join(", ") : "Standard business software";

  const glossary =
    orgContext.glossary && Object.keys(orgContext.glossary).length > 0
      ? Object.entries(orgContext.glossary)
          .map(([term, def]) => `${term} = ${def}`)
          .join(", ")
      : "None specified";

  const examples =
    similarPlans.length > 0
      ? similarPlans
          .map((p, i) => `Example ${i + 1}: ${p.plan_text}`)
          .join("\n\n")
      : "";

  const system = `You are an expert corporate learning execution designer. You create multi-step action plans (2–10 steps as appropriate) that transform training content into concrete behavioral change.

COMPANY CONTEXT:
${orgContext.company_description || "Not specified"}
Industry: ${orgContext.industry || "Not specified"}

TARGET EMPLOYEE ROLE: ${targetRole}
Their typical day: ${typicalDay}
Tools they use: ${tools}

HOW THIS COMPANY APPLIES TRAINING:
${orgContext.application_types.length > 0 ? orgContext.application_types.join(". ") : "General professional growth"}

ACTIVITIES THE AI MUST NEVER SUGGEST:
${orgContext.forbidden_activities?.trim() || "None specified"}

COMPANY VOCABULARY:
${glossary}

CONTENT ANALYSIS (from Stage 1):
Key concepts: ${analysis.key_concepts.join(", ")}
Skills taught: ${analysis.skills_taught.join(", ")}
Behavioral changes advocated: ${analysis.behavioral_changes_advocated.join(", ")}
Category: ${analysis.category}

${examples ? `EXAMPLES OF GOOD PLANS PREVIOUSLY APPROVED FOR THIS COMPANY:\n${examples}\n` : ""}
RULES:
1. Step 1 must be completable in under 15 minutes during the employee's normal workday
2. Every step must reference the employee's actual work activities and tools — not generic exercises
3. Success criteria must be objectively verifiable (something a manager could confirm happened)
4. Each step must build on the previous one, creating a progression from awareness to application to habit
5. Use the company's vocabulary and terminology where appropriate
6. If the content is video, include timestamp ranges for relevant sections (seconds as integers; use 0 if not applicable)
7. Instructions must be specific enough that the employee knows EXACTLY what to do without interpretation
8. If similar approved plans exist, match their tone and specificity level

Choose an appropriate number of steps between 2 and 10 based on content depth. Generate the execution plan.`;

  let userMsg = `Full transcript for grounding:\n\n${transcript.slice(0, 120_000)}`;
  if (options?.priorValidationFeedback?.trim()) {
    userMsg += `\n\n---\nPrior validation feedback — address these issues in the revised plan:\n${options.priorValidationFeedback.trim()}`;
  }

  const completion = await aiClient.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    response_format: {
      type: "json_schema",
      json_schema: generatedPlanJsonSchema,
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Stage 2: empty model response");

  const parsed = JSON.parse(content) as GeneratedPlan;
  return normalizePlan(parsed);
}
