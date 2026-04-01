import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { purgeContentSourceFile } from "@/lib/content/purgeContentSourceFile";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function transcribeUploadedMedia(contentItemId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: item, error: itemError } = await admin
    .from("content_items")
    .select("id, file_path, metadata")
    .eq("id", contentItemId)
    .single();

  if (itemError || !item?.file_path) {
    throw new Error(itemError?.message ?? "Content item or file path missing");
  }

  const baseMeta =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};

  const apiKey = process.env.OPENAI_API_KEY;
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

  await admin.from("content_items").update({ status: "transcribing" }).eq("id", contentItemId);

  try {
    const { data: blob, error: downloadError } = await admin.storage
      .from("content-files")
      .download(item.file_path);
    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "Storage download failed");
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { basename, mime } = guessMimeAndName(item.file_path);
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

    const { error: updateError } = await admin
      .from("content_items")
      .update({
        transcript: text,
        status: "ready",
        metadata: { ...baseMeta, whisper: true },
      })
      .eq("id", contentItemId);
    if (updateError) {
      throw new Error(updateError.message);
    }

    await purgeContentSourceFile(admin, contentItemId, { throwOnStorageError: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("content_items")
      .update({
        status: "failed",
        metadata: { ...baseMeta, error: message },
      })
      .eq("id", contentItemId);
    throw error;
  }
}
