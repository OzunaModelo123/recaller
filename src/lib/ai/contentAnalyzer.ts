import type { OrgContext } from "./orgContext";
import { ANALYSIS_MODEL, anthropicClient } from "./modelRouter";

export type ContentAnalysis = {
  key_concepts: string[];
  skills_taught: string[];
  behavioral_changes_advocated: string[];
  applicable_roles: string[];
  complexity: "beginner" | "intermediate" | "advanced";
  category: string;
  estimated_content_quality: number;
  risk_flags: string[];
  summary: string;
};

const contentAnalysisTool = {
  name: "content_analysis" as const,
  description:
    "Return the structured content analysis. Call this tool exactly once with all fields populated.",
  input_schema: {
    type: "object" as const,
    required: [
      "key_concepts",
      "skills_taught",
      "behavioral_changes_advocated",
      "applicable_roles",
      "complexity",
      "category",
      "estimated_content_quality",
      "risk_flags",
      "summary",
    ],
    properties: {
      key_concepts: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "3–5 most important ideas taught",
      },
      skills_taught: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Specific skills this content develops",
      },
      behavioral_changes_advocated: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "What the content wants people to DO differently",
      },
      applicable_roles: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Which of the company's roles would benefit most",
      },
      complexity: {
        type: "string" as const,
        enum: ["beginner", "intermediate", "advanced"],
      },
      category: {
        type: "string" as const,
        description:
          "e.g. sales technique, compliance, leadership, technical skills",
      },
      estimated_content_quality: {
        type: "integer" as const,
        description: "1–5 rating of the training content quality",
      },
      risk_flags: {
        type: "array" as const,
        items: { type: "string" as const },
        description:
          "Concerns like outdated info, compliance-sensitive, etc. Empty array if none",
      },
      summary: {
        type: "string" as const,
        description: "Exactly three sentences on what this content teaches",
      },
    },
  },
};

export async function analyzeContent(
  transcript: string,
  orgContext: OrgContext,
): Promise<ContentAnalysis> {
  const roleNames =
    orgContext.roles.map((r) => r.name).join(", ") || "General";
  const applications =
    orgContext.application_types.length > 0
      ? orgContext.application_types.join(", ")
      : "General workplace application";

  const system = `You are an expert corporate training content analyst. You are analyzing training content for a company with this context:

Company: ${orgContext.company_description || "Not specified"}
Industry: ${orgContext.industry || "Not specified"}
Roles using this training: ${roleNames}
How they apply training: ${applications}

Analyze the following transcript and return a structured analysis. Do NOT generate a plan — only analyze.

Use the content_analysis tool to return your analysis. Fill every field:
- key_concepts: 3–5 most important ideas taught
- skills_taught: specific skills the content develops
- behavioral_changes_advocated: what the content wants people to DO differently
- applicable_roles: which of the company's roles would benefit most (use role names from context when relevant)
- complexity: beginner | intermediate | advanced
- category: e.g. sales technique, compliance, leadership, technical skills
- estimated_content_quality: integer 1–5 (is this good training content?)
- risk_flags: concerns (outdated info, compliance-sensitive, etc.) — empty array if none
- summary: exactly three sentences on what this content teaches`;

  const userContent = `Transcript:\n\n${transcript.slice(0, 200_000)}`;

  const response = await anthropicClient.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent }],
    tools: [contentAnalysisTool],
    tool_choice: { type: "tool", name: "content_analysis" },
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Stage 1 analysis: model did not return tool_use block");
  }

  const parsed = toolBlock.input as Record<string, unknown>;

  const strArr = (k: string): string[] =>
    Array.isArray(parsed[k])
      ? (parsed[k] as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];

  const complexityRaw = parsed.complexity;
  const complexity =
    complexityRaw === "beginner" ||
    complexityRaw === "intermediate" ||
    complexityRaw === "advanced"
      ? complexityRaw
      : "intermediate";

  let q =
    typeof parsed.estimated_content_quality === "number"
      ? parsed.estimated_content_quality
      : 3;
  if (q < 1) q = 1;
  if (q > 5) q = 5;

  return {
    key_concepts: strArr("key_concepts").slice(0, 8),
    skills_taught: strArr("skills_taught").slice(0, 8),
    behavioral_changes_advocated: strArr(
      "behavioral_changes_advocated",
    ).slice(0, 8),
    applicable_roles: strArr("applicable_roles").slice(0, 8),
    complexity,
    category:
      typeof parsed.category === "string" ? parsed.category : "general",
    estimated_content_quality: Math.round(q),
    risk_flags: strArr("risk_flags").slice(0, 10),
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}
