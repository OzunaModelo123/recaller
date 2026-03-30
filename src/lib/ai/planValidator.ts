import type { ContentAnalysis } from "./contentAnalyzer";
import type { GeneratedPlan } from "./planGenerator";
import type { OrgContext } from "./orgContext";
import { VALIDATION_MODEL, openaiClient } from "./modelRouter";

export type ValidationResult = {
  scores: {
    relevance: number;
    specificity: number;
    progressiveness: number;
    feasibility: number;
    measurability: number;
  };
  overall_score: number;
  forbidden_activity_violation: boolean;
  feedback: string;
  pass: boolean;
};

const validationJsonSchema = {
  name: "plan_validation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "scores",
      "overall_score",
      "forbidden_activity_violation",
      "feedback",
      "pass",
    ],
    properties: {
      scores: {
        type: "object",
        additionalProperties: false,
        required: [
          "relevance",
          "specificity",
          "progressiveness",
          "feasibility",
          "measurability",
        ],
        properties: {
          relevance: { type: "integer" },
          specificity: { type: "integer" },
          progressiveness: { type: "integer" },
          feasibility: { type: "integer" },
          measurability: { type: "integer" },
        },
      },
      overall_score: { type: "number" },
      forbidden_activity_violation: { type: "boolean" },
      feedback: { type: "string" },
      pass: { type: "boolean" },
    },
  },
} as const;

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export async function validatePlan(
  plan: GeneratedPlan,
  orgContext: OrgContext,
  analysis: ContentAnalysis,
): Promise<ValidationResult> {
  const system = `You are a quality assurance reviewer for corporate training execution plans. Score the following plan on 5 dimensions using a 1-5 scale (integers only).

COMPANY CONTEXT:
${orgContext.company_description || "Not specified"}
Activities they should NEVER suggest: ${orgContext.forbidden_activities || "None specified"}
How they apply training: ${orgContext.application_types.join(", ") || "General"}

CONTENT ANALYSIS:
Key concepts: ${analysis.key_concepts.join(", ")}
Skills taught: ${analysis.skills_taught.join(", ")}

Score each dimension 1-5:
1. relevance: Do the steps directly relate to what employees at this company actually do?
2. specificity: Are instructions concrete enough to follow without interpretation? (No vague 'reflect on...' or 'think about...')
3. progressiveness: Does each step build meaningfully on the previous one?
4. feasibility: Can Step 1 realistically be done in 15 minutes during a normal workday?
5. measurability: Can a manager objectively verify each success criteria was met? Also score whether each step is trackable in Recaller: proof_type and proof_instructions must match the action; evidence can be collected on the web app (text, link, file path later); a manager could judge a real submission.

Also flag: does any step suggest a forbidden activity?

Return JSON matching the schema: scores (integers 1-5), overall_score (average of the five), forbidden_activity_violation, feedback (1-2 sentences if any score < 4, else brief ok), pass (true if overall_score >= 3.5 AND no forbidden_activity_violation).`;

  const user = `THE PLAN TO EVALUATE:\n${JSON.stringify(plan)}`;

  const completion = await openaiClient.chat.completions.create({
    model: VALIDATION_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: validationJsonSchema,
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Stage 3: empty model response");

  const raw = JSON.parse(content) as {
    scores: Record<string, number>;
    overall_score: number;
    forbidden_activity_violation: boolean;
    feedback: string;
    pass: boolean;
  };

  const scores = {
    relevance: clampScore(raw.scores.relevance),
    specificity: clampScore(raw.scores.specificity),
    progressiveness: clampScore(raw.scores.progressiveness),
    feasibility: clampScore(raw.scores.feasibility),
    measurability: clampScore(raw.scores.measurability),
  };

  const overall =
    (scores.relevance +
      scores.specificity +
      scores.progressiveness +
      scores.feasibility +
      scores.measurability) /
    5;

  const pass =
    overall >= 3.5 && !raw.forbidden_activity_violation;

  return {
    scores,
    overall_score: Math.round(overall * 10) / 10,
    forbidden_activity_violation: Boolean(raw.forbidden_activity_violation),
    feedback: typeof raw.feedback === "string" ? raw.feedback : "",
    pass,
  };
}
