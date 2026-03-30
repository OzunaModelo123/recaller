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

function stripJsonPayload(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

export async function analyzeContent(
  transcript: string,
  orgContext: OrgContext,
): Promise<ContentAnalysis> {
  const roleNames = orgContext.roles.map((r) => r.name).join(", ") || "General";
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

Return JSON only (no markdown) with this exact shape:
{
  "key_concepts": string[],
  "skills_taught": string[],
  "behavioral_changes_advocated": string[],
  "applicable_roles": string[],
  "complexity": "beginner" | "intermediate" | "advanced",
  "category": string,
  "estimated_content_quality": number (1-5 integer),
  "risk_flags": string[],
  "summary": string (3 sentences)
}`;

  const userContent = `Transcript:\n\n${transcript.slice(0, 200_000)}`;

  const msg = await anthropicClient.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system: system,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = msg.content.find((c) => c.type === "text");
  const rawText =
    textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonStr = stripJsonPayload(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr) as unknown;
  } catch {
    throw new Error("Stage 1 analysis returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stage 1 analysis: invalid object");
  }
  const o = parsed as Record<string, unknown>;

  const strArr = (k: string): string[] =>
    Array.isArray(o[k])
      ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

  const complexityRaw = o.complexity;
  const complexity =
    complexityRaw === "beginner" ||
    complexityRaw === "intermediate" ||
    complexityRaw === "advanced"
      ? complexityRaw
      : "intermediate";

  let q = typeof o.estimated_content_quality === "number" ? o.estimated_content_quality : 3;
  if (q < 1) q = 1;
  if (q > 5) q = 5;

  return {
    key_concepts: strArr("key_concepts").slice(0, 8),
    skills_taught: strArr("skills_taught").slice(0, 8),
    behavioral_changes_advocated: strArr("behavioral_changes_advocated").slice(0, 8),
    applicable_roles: strArr("applicable_roles").slice(0, 8),
    complexity,
    category: typeof o.category === "string" ? o.category : "general",
    estimated_content_quality: Math.round(q),
    risk_flags: strArr("risk_flags").slice(0, 10),
    summary: typeof o.summary === "string" ? o.summary : "",
  };
}
