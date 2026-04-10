import { inngest } from "@/lib/inngest/client";
import {
  finalizeTranscription,
  getTranscriptionPlan,
  transcribeSingleAsset,
  transcribeUploadedMedia,
  type TranscriptionPlan,
} from "@/lib/content/transcribeUploadedMedia";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transcribe uploaded media using an Inngest fan-out / fan-in pattern.
 *
 * 1. **plan** — Read the content item and determine the list of audio assets.
 * 2. **transcribe-chunk-N** — Each asset is transcribed in its own step, running
 *    in parallel across Inngest workers (massively faster than sequential).
 * 3. **finalize** — Merge all chunk transcripts, save to DB, and purge storage.
 *
 * Falls back to the legacy all-in-one path when there is only a single asset
 * (e.g., a small MP4 or MP3 that was uploaded directly without segmentation).
 */
export const transcribeContent = inngest.createFunction(
  {
    id: "transcribe-content",
    name: "Transcribe uploaded media",
    triggers: [{ event: "content/transcribe.requested" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { contentItemId } = event.data as { contentItemId: string };

    // Step 1: Determine what needs transcribing
    const plan = await step.run("plan-transcription", async () => {
      return getTranscriptionPlan(contentItemId);
    });

    // For single-file uploads (e.g., small MP4, MP3), use the simpler all-in-one path
    if (plan.assets.length <= 1) {
      await step.run("transcribe-single-file", async () => {
        await transcribeUploadedMedia(contentItemId);
      });
      return;
    }

    // Step 2: Fan-out — transcribe each chunk in parallel Inngest steps
    const transcriptParts: string[] = [];

    // Inngest runs each step independently; steps with different IDs execute in parallel
    const results = await Promise.all(
      plan.assets.map((asset, index) =>
        step.run(`transcribe-chunk-${index}`, async () => {
          try {
            const text = await transcribeSingleAsset(asset);
            return { index, text, ok: true as const };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[transcribe-chunk-${index}] failed:`, message);
            return { index, text: "", ok: false as const, error: message };
          }
        }),
      ),
    );

    // Check for failures
    const failures = results.filter((r) => !r.ok);
    if (failures.length > 0 && failures.length === results.length) {
      // All chunks failed — mark the content item as failed
      const admin = createAdminClient();
      await admin
        .from("content_items")
        .update({
          status: "failed",
          metadata: {
            ...plan.baseMeta,
            error: `All ${failures.length} transcription chunks failed. First error: ${failures[0].error}`,
          },
        })
        .eq("id", contentItemId);
      throw new Error(`All transcription chunks failed`);
    }

    // Sort results by index to maintain correct order
    const sortedTexts = results
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text);

    // Step 3: Fan-in — merge transcripts, save to DB, purge storage
    await step.run("finalize-transcription", async () => {
      await finalizeTranscription(contentItemId, sortedTexts, plan);
    });
  },
);
