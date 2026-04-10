import { inngest } from "@/lib/inngest/client";
import {
  finalizeTranscription,
  getTranscriptionPlan,
  transcribeSingleAsset,
  transcribeUploadedMedia,
} from "@/lib/content/transcribeUploadedMedia";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transcribe uploaded media using an Inngest fan-out / fan-in pattern.
 *
 * Routing:
 * - plan.mode === "single"    → legacy all-in-one path (raw source file that needs FFmpeg).
 * - plan.mode === "segmented" → fan-out path (pre-extracted audio chunks from the browser).
 *                               Uses transcribeSingleAsset per chunk so each chunk is its
 *                               own Inngest step. Critically, this applies even when there
 *                               is only ONE segment — the previous bug was using
 *                               `plan.assets.length <= 1` which wrongly routed a single
 *                               WebCodecs-extracted audio segment into the all-in-one path.
 *
 * onFailure: When Inngest exhausts all retries (e.g., a step is killed by a timeout before
 * our try/catch can run), this handler marks the item "failed" in the DB so the status is
 * never permanently stuck at "transcribing".
 */
export const transcribeContent = inngest.createFunction(
  {
    id: "transcribe-content",
    name: "Transcribe uploaded media",
    triggers: [{ event: "content/transcribe.requested" }],
    retries: 2,
    onFailure: async ({ event }) => {
      // Called by Inngest after all retries are exhausted.
      // Inngest v4 FailureEventPayload shape:
      //   event.data.event  = the original triggering event
      //   event.data.error  = the error that caused the failure
      // So contentItemId lives at event.data.event.data.contentItemId — NOT event.data.contentItemId.
      const originalData = (event.data as { event?: { data?: unknown } })?.event?.data;
      const contentItemId = (originalData as { contentItemId?: string } | undefined)?.contentItemId;
      if (!contentItemId) return;
      const admin = createAdminClient();
      // Only overwrite if still stuck at "transcribing" — don't clobber a "ready" status
      // that may have arrived via a concurrent successful path.
      await admin
        .from("content_items")
        .update({
          status: "failed",
          metadata: { error: "Transcription timed out or failed after all retries." },
        })
        .eq("id", contentItemId)
        .eq("status", "transcribing");
    },
  },
  async ({ event, step }) => {
    const { contentItemId } = event.data as { contentItemId: string };

    // Step 1: Read the content item, decide the transcription plan, set status → "transcribing"
    const plan = await step.run("plan-transcription", async () => {
      return getTranscriptionPlan(contentItemId);
    });

    // ── Single-file path (raw source file: MP3, small MP4, or server-FFmpeg upload) ──
    // plan.mode === "single" means no pre-extracted audio segments exist in storage.
    // The worker downloads the raw file, runs FFmpeg if needed, splits, and transcribes.
    if (plan.mode === "single") {
      await step.run("transcribe-single-file", async () => {
        await transcribeUploadedMedia(contentItemId);
      });
      return;
    }

    // ── Fan-out path (pre-extracted audio segments from WebCodecs / MediaRecorder) ──
    // Each segment runs in its own Inngest step so:
    //   • Multiple segments run in parallel (faster)
    //   • A single timed-out segment doesn't block others
    //   • Even a 1-segment WebCodecs upload uses this cleaner path (the routing fix)
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

    // If every chunk failed, mark the item as failed and stop
    const failures = results.filter((r) => !r.ok);
    if (failures.length > 0 && failures.length === results.length) {
      const admin = createAdminClient();
      await admin
        .from("content_items")
        .update({
          status: "failed",
          metadata: {
            ...plan.baseMeta,
            error: `All ${failures.length} transcription chunks failed. First error: ${failures[0]?.error}`,
          },
        })
        .eq("id", contentItemId);
      throw new Error(`All ${failures.length} transcription chunks failed`);
    }

    // Step N+1: Fan-in — merge transcripts in order, save to DB, purge storage
    const sortedTexts = results
      .sort((a, b) => a.index - b.index)
      .map((r) => r.text);

    await step.run("finalize-transcription", async () => {
      await finalizeTranscription(contentItemId, sortedTexts, plan);
    });
  },
);
