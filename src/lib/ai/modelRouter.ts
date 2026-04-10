import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

function requireKey(name: string): string {
  const key = process.env[name];
  if (!key?.trim()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`[modelRouter] ${name} is not set — AI features will fail.`);
    return "";
  }
  return key;
}

/** Anthropic client — Claude for content analysis (Stage 1) and narrative reports. */
export const anthropicClient = new Anthropic({
  apiKey: requireKey("ANTHROPIC_API_KEY"),
});

/** OpenAI client — GPT-4.1 for plan generation (Stage 2), GPT-4.1 Mini for validation (Stage 3), embeddings. */
export const openaiClient = new OpenAI({
  apiKey: requireKey("OPENAI_API_KEY"),
});

export const ANALYSIS_MODEL = "claude-sonnet-4-20250514";
export const GENERATION_MODEL = "gpt-4.1";
export const VALIDATION_MODEL = "gpt-4.1-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const NARRATIVE_MODEL = "claude-sonnet-4-20250514";

export const embeddingClient: OpenAI = openaiClient;
