import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

import { EMBEDDING_MODEL, openaiClient } from "./modelRouter";

const CHUNK_CHAR_TARGET = 1600;
const MAX_BACKOFF_MS = 16_000;

export type SimilarPlan = {
  plan_id: string;
  plan_text: string;
  similarity: number;
};

export type ContentChunk = {
  content_item_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function vectorParamEmbedding(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.slice(0, 300_000);
  let attempt = 0;
  for (;;) {
    try {
      const res = await openaiClient.embeddings.create({
        model: EMBEDDING_MODEL,
        input,
      });
      const vec = res.data[0]?.embedding;
      if (!vec?.length) throw new Error("Empty embedding response");
      return vec;
    } catch (e: unknown) {
      const status =
        e && typeof e === "object" && "status" in e
          ? (e as { status?: number }).status
          : undefined;
      const retriable =
        status === 429 || status === 503 || status === 502 || status === 500;
      if (!retriable || attempt >= 5) throw e;
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt);
      await sleep(delay + Math.random() * 250);
      attempt += 1;
    }
  }
}

/**
 * Split transcript into paragraph-oriented chunks (~400 tokens each).
 */
export function chunkTranscript(transcript: string): string[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const pushBuf = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const para of paragraphs) {
    if (para.length > CHUNK_CHAR_TARGET) {
      pushBuf();
      for (let i = 0; i < para.length; i += CHUNK_CHAR_TARGET) {
        chunks.push(para.slice(i, i + CHUNK_CHAR_TARGET));
      }
      continue;
    }
    if (!buf.length) {
      buf = para;
      continue;
    }
    if (buf.length + 2 + para.length <= CHUNK_CHAR_TARGET) {
      buf = `${buf}\n\n${para}`;
    } else {
      pushBuf();
      buf = para;
    }
  }
  pushBuf();

  return chunks.length ? chunks : [trimmed.slice(0, 50_000)];
}

export async function embedContentItem(
  contentItemId: string,
  orgId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("content_items")
    .select("id, org_id, transcript")
    .eq("id", contentItemId)
    .single();

  if (fetchErr || !row) {
    throw new Error(fetchErr?.message ?? "Content item not found");
  }
  if (row.org_id !== orgId) {
    throw new Error("Content item org mismatch");
  }
  const transcript = row.transcript?.trim();
  if (!transcript) {
    throw new Error("No transcript to embed");
  }

  const chunks = chunkTranscript(transcript);
  if (chunks.length === 0) return;

  await admin.from("content_embeddings").delete().eq("content_item_id", contentItemId);

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i]!;
    const embedding = await generateEmbedding(chunkText);
    const { error: insErr } = await admin.from("content_embeddings").insert({
      content_item_id: contentItemId,
      org_id: orgId,
      chunk_index: i,
      chunk_text: chunkText,
      embedding: vectorParamEmbedding(embedding),
    });
    if (insErr) throw new Error(insErr.message);
  }

  const { error: upErr } = await admin
    .from("content_items")
    .update({ transcript_chunks: chunks })
    .eq("id", contentItemId);
  if (upErr) throw new Error(upErr.message);
}

export function serializePlanForEmbedding(planBody: {
  title: string;
  steps: { step_number: number; title: string; instructions: string }[];
}): string {
  const parts = planBody.steps
    .slice()
    .sort((a, b) => a.step_number - b.step_number)
    .map(
      (s) =>
        `Step ${s.step_number}: ${s.title} — ${s.instructions}`,
    );
  return `Plan: ${planBody.title}. ${parts.join(" ")}`;
}

export async function embedApprovedPlan(
  planId: string,
  orgId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: plan, error } = await admin
    .from("plans")
    .select("id, org_id, current_version")
    .eq("id", planId)
    .single();

  if (error || !plan) throw new Error(error?.message ?? "Plan not found");
  if (plan.org_id !== orgId) throw new Error("Plan org mismatch");

  const cv = plan.current_version as unknown;
  if (!cv || typeof cv !== "object" || Array.isArray(cv)) {
    throw new Error("Invalid current_version for embedding");
  }
  const o = cv as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const steps = Array.isArray(o.steps) ? o.steps : [];
  const normalized = steps
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const st = s as Record<string, unknown>;
      const stepNumber = typeof st.step_number === "number" ? st.step_number : 0;
      const stTitle = typeof st.title === "string" ? st.title : "";
      const instructions =
        typeof st.instructions === "string" ? st.instructions : "";
      return { step_number: stepNumber, title: stTitle, instructions };
    })
    .filter(
      (x): x is { step_number: number; title: string; instructions: string } =>
        x !== null && x.step_number >= 1,
    );

  const planText = serializePlanForEmbedding({ title, steps: normalized });
  if (!planText.trim()) throw new Error("Empty plan text");

  await admin
    .from("plan_embeddings")
    .delete()
    .eq("plan_id", planId)
    .eq("is_admin_approved", true);

  const embedding = await generateEmbedding(planText);
  const { error: insErr } = await admin.from("plan_embeddings").insert({
    plan_id: planId,
    org_id: orgId,
    plan_text: planText,
    embedding: vectorParamEmbedding(embedding),
    is_admin_approved: true,
  });
  if (insErr) throw new Error(insErr.message);
}

export async function findSimilarApprovedPlans(
  supabase: SupabaseClient<Database>,
  queryText: string,
  orgId: string,
  limit: number = 3,
): Promise<SimilarPlan[]> {
  const q = queryText.trim();
  if (!q) return [];

  const embedding = await generateEmbedding(q.slice(0, 8000));
  const { data, error } = await supabase.rpc("match_plan_embeddings", {
    p_org_id: orgId,
    p_query_embedding: vectorParamEmbedding(embedding),
    p_match_count: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    plan_id: r.plan_id,
    plan_text: r.plan_text,
    similarity: r.similarity,
  }));
}

export async function findRelevantContentChunks(
  supabase: SupabaseClient<Database>,
  queryText: string,
  orgId: string,
  limit: number = 5,
): Promise<ContentChunk[]> {
  const q = queryText.trim();
  if (!q) return [];

  const embedding = await generateEmbedding(q.slice(0, 8000));
  const { data, error } = await supabase.rpc("match_content_chunks", {
    p_org_id: orgId,
    p_query_embedding: vectorParamEmbedding(embedding),
    p_match_count: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    content_item_id: r.content_item_id,
    chunk_index: r.chunk_index,
    chunk_text: r.chunk_text,
    similarity: r.similarity,
  }));
}

export async function contentItemHasEmbeddings(
  contentItemId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("content_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("content_item_id", contentItemId);

  if (error) return false;
  return (count ?? 0) > 0;
}
