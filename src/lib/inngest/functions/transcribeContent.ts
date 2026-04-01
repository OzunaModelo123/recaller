import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { purgeContentSourceFile } from "@/lib/content/purgeContentSourceFile";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

function guessMimeAndName(filePath: string): { basename: string; mime: string } {
  const basename = filePath.split("/").pop() || "media.bin";
  const lower = basename.toLowerCase();
  if (lower.endsWith(".mp3")) return { basename, mime: "audio/mpeg" };
  if (lower.endsWith(".mp4")) return { basename, mime: "video/mp4" };
  if (lower.endsWith(".m4a")) return { basename, mime: "audio/mp4" };
  if (lower.endsWith(".wav")) return { basename, mime: "audio/wav" };
  if (lower.endsWith(".webm")) return { basename, mime: "audio/webm" };
  if (lower.endsWith(".mpeg") || lower.endsWith(".mpga")) return { basename, mime: "audio/mpeg" };
  return { basename, mime: "application/octet-stream" };
}

export const transcribeContent = inngest.createFunction(
  {
    id: "transcribe-content",
    name: "Transcribe uploaded media",
    triggers: [{ event: "content/transcribe.requested" }],
  },
  async ({ event, step }) => {
    const { contentItemId } = event.data as { contentItemId: string };

    const item = await step.run("fetch-item", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("content_items")
        .select("id, file_path, title, metadata")
        .eq("id", contentItemId)
        .single();
      if (error || !data?.file_path) {
        throw new Error(error?.message ?? "Content item or file path missing");
      }
      return data;
    });

    await step.run("set-transcribing", async () => {
      const admin = createAdminClient();
      const { error } = await admin
        .from("content_items")
        .update({ status: "transcribing" })
        .eq("id", contentItemId);
      if (error) throw new Error(error.message);
    });

    await step.run("whisper-and-save", async () => {
      const admin = createAdminClient();
      const apiKey = process.env.OPENAI_API_KEY;
      const baseMeta =
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {};

      if (!apiKey) {
        await admin
          .from("content_items")
          .update({
            status: "failed",
            metadata: { ...baseMeta, error: "OPENAI_API_KEY is not configured" },
          })
          .eq("id", contentItemId);
        throw new Error("OPENAI_API_KEY is not configured");
      }

      try {
        const { data: blob, error: dlError } = await admin.storage
          .from("content-files")
          .download(item.file_path!);
        if (dlError || !blob) {
          throw new Error(dlError?.message ?? "Storage download failed");
        }
        const buffer = Buffer.from(await blob.arrayBuffer());
        const { basename, mime } = guessMimeAndName(item.file_path!);
        const file = await toFile(buffer, basename, { type: mime });

        const openai = new OpenAI({ apiKey });
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
        });
        const text = transcription.text?.trim() ?? "";
        if (!text) {
          throw new Error("Whisper returned empty text");
        }

        const { error: upError } = await admin
          .from("content_items")
          .update({
            transcript: text,
            status: "ready",
            metadata: { ...baseMeta, whisper: true },
          })
          .eq("id", contentItemId);
        if (upError) throw new Error(upError.message);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await admin
          .from("content_items")
          .update({
            status: "failed",
            metadata: { ...baseMeta, error: message },
          })
          .eq("id", contentItemId);
        throw e;
      }
    });

    await step.run("remove-source-media", async () => {
      const admin = createAdminClient();
      await purgeContentSourceFile(admin, contentItemId, { throwOnStorageError: true });
    });
  },
);
