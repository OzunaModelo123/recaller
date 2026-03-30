import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/** Anthropic client — Claude for content analysis (Stage 1) and narrative reports. */
export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

/** OpenAI client — GPT-4.1 for plan generation (Stage 2), GPT-4.1 Mini for validation (Stage 3), embeddings. */
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export const ANALYSIS_MODEL = "claude-sonnet-4-20250514";
export const GENERATION_MODEL = "gpt-4.1";
export const VALIDATION_MODEL = "gpt-4.1-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const NARRATIVE_MODEL = "claude-sonnet-4-20250514";

export const embeddingClient: OpenAI = openaiClient;
