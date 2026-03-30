import OpenAI from "openai";

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Stage 1: deep comprehension (same provider as stages 2–3) */
export const ANALYSIS_MODEL = "gpt-4.1";
/** Stage 2: structured plan JSON */
export const GENERATION_MODEL = "gpt-4.1";
/** Stage 3: validation scores */
export const VALIDATION_MODEL = "gpt-4.1-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
/** Insight reports (later phases) */
export const NARRATIVE_MODEL = "gpt-4.1";
