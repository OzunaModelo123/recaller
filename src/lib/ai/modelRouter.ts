import OpenAI from "openai";

/** `grok` (default) uses xAI; `openai` restores the original GPT-4.1 pipeline. */
export type AiProviderName = "grok" | "openai";

const rawProvider = (process.env.AI_PROVIDER ?? "grok").toLowerCase();
export const activeAiProvider: AiProviderName =
  rawProvider === "openai" ? "openai" : "grok";

const XAI_BASE_URL = "https://api.x.ai/v1";

/** OpenAI SDK client pointed at xAI (chat completions + structured outputs). */
export const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY ?? "",
  baseURL: XAI_BASE_URL,
});

/** Native OpenAI API (used when AI_PROVIDER=openai for chat, and always for embeddings when a key exists). */
export const openaiNativeClient: OpenAI | null =
  process.env.OPENAI_API_KEY?.trim()
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

/** Chat pipeline client: Grok or OpenAI depending on `AI_PROVIDER`. */
export const aiClient: OpenAI =
  activeAiProvider === "grok"
    ? grokClient
    : (openaiNativeClient ??
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY ?? "",
      }));

/**
 * Embeddings only — xAI has no embedding model; uses OpenAI text-embedding-3-small.
 * Null when OPENAI_API_KEY is unset (plan generation still works; similarity / chunk embeds are skipped).
 */
export const embeddingClient: OpenAI | null = openaiNativeClient;

// --- OpenAI model IDs (original plan; used when AI_PROVIDER=openai) ---
const OPENAI_ANALYSIS_MODEL = "gpt-4.1";
const OPENAI_GENERATION_MODEL = "gpt-4.1";
const OPENAI_VALIDATION_MODEL = "gpt-4.1-mini";
const OPENAI_NARRATIVE_MODEL = "gpt-4.1";

// --- Grok model IDs (cost-effective; structured outputs supported) ---
const GROK_CHAT_MODEL = "grok-3-mini-fast";

/** Stage 1: deep comprehension */
export const ANALYSIS_MODEL =
  activeAiProvider === "grok" ? GROK_CHAT_MODEL : OPENAI_ANALYSIS_MODEL;
/** Stage 2: structured plan JSON */
export const GENERATION_MODEL =
  activeAiProvider === "grok" ? GROK_CHAT_MODEL : OPENAI_GENERATION_MODEL;
/** Stage 3: validation scores */
export const VALIDATION_MODEL =
  activeAiProvider === "grok" ? GROK_CHAT_MODEL : OPENAI_VALIDATION_MODEL;
export const EMBEDDING_MODEL = "text-embedding-3-small";
/** Insight reports (later phases) */
export const NARRATIVE_MODEL =
  activeAiProvider === "grok" ? GROK_CHAT_MODEL : OPENAI_NARRATIVE_MODEL;
