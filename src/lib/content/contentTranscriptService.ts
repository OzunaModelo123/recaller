import { detectUrlSource, type UrlSourceType } from "@/lib/content/detectUrlSource";
import { extractArticleText } from "@/lib/content/articleExtractor";
import { extractDocxText } from "@/lib/content/docxExtractor";
import { extractLoomTranscript } from "@/lib/content/loomExtractor";
import { extractPdfText } from "@/lib/content/pdfExtractor";
import { transcribeUploadedMedia } from "@/lib/content/transcribeUploadedMedia";
import { extractVimeoTranscript } from "@/lib/content/vimeoExtractor";
import { extractYouTubeTranscript } from "@/lib/content/youtubeExtractor";

export type SupportedFileSourceType = "pdf" | "docx" | "mp3" | "mp4";

export type UrlTranscriptResult = {
  sourceType: UrlSourceType;
  title?: string;
  transcript: string;
  metadata: Record<string, unknown>;
};

export type FileTranscriptResult =
  | {
      sourceType: "pdf" | "docx";
      mode: "instant";
      transcript: string;
    }
  | {
      sourceType: "mp3" | "mp4";
      mode: "background";
    };

export async function extractTranscriptFromUrl(url: string): Promise<UrlTranscriptResult> {
  const sourceType = detectUrlSource(url);
  if (!sourceType) {
    throw new Error("Could not understand this URL.");
  }

  if (sourceType === "youtube") {
    const { transcript, metadata } = await extractYouTubeTranscript(url);
    return {
      sourceType,
      title: typeof metadata.title === "string" ? metadata.title : undefined,
      transcript,
      metadata,
    };
  }

  if (sourceType === "vimeo") {
    const transcript = await extractVimeoTranscript(url);
    if (!transcript) {
      throw new Error(
        process.env.VIMEO_ACCESS_TOKEN
          ? "No captions on this Vimeo video. Upload the video file for AI transcription."
          : "Vimeo captions require VIMEO_ACCESS_TOKEN in the server environment, or upload the video file for AI transcription.",
      );
    }
    return {
      sourceType,
      title: "Vimeo video",
      transcript,
      metadata: {},
    };
  }

  if (sourceType === "loom") {
    const transcript = await extractLoomTranscript(url);
    if (!transcript) {
      throw new Error(
        "No Loom transcript was found. Upload the recording file for AI transcription.",
      );
    }
    return {
      sourceType,
      title: "Loom video",
      transcript,
      metadata: {},
    };
  }

  let title = "Web article";
  try {
    const parsedUrl = new URL(url.trim());
    title = parsedUrl.hostname.replace(/^www\./, "");
  } catch {
    /* keep default title */
  }

  return {
    sourceType: "web_article",
    title,
    transcript: await extractArticleText(url),
    metadata: {},
  };
}

export async function extractTranscriptFromFile(
  sourceType: SupportedFileSourceType,
  buffer: Buffer,
): Promise<FileTranscriptResult> {
  if (sourceType === "pdf") {
    return {
      sourceType,
      mode: "instant",
      transcript: await extractPdfText(buffer),
    };
  }

  if (sourceType === "docx") {
    return {
      sourceType,
      mode: "instant",
      transcript: await extractDocxText(buffer),
    };
  }

  return {
    sourceType,
    mode: "background",
  };
}

export async function runBackgroundMediaTranscript(contentItemId: string): Promise<void> {
  // In local development, Inngest Cloud cannot reach localhost:3000, so events would
  // queue up in the cloud but never get executed. We bypass Inngest entirely and run
  // transcription directly inside the after() callback instead.
  //
  // In production (Vercel), NODE_ENV === "production" and Inngest Cloud can reach the
  // deployed URL, so we use inngest.send() to hand off to the background worker.
  if (process.env.NODE_ENV !== "production") {
    console.log("[runBackgroundMediaTranscript] Dev mode — running transcription directly (no Inngest)");
    await transcribeUploadedMedia(contentItemId);
    return;
  }

  try {
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      name: "content/transcribe.requested",
      data: { contentItemId },
    });
  } catch (dispatchError) {
    // Inngest dispatch failed — fall back to direct transcription.
    // This still works but may timeout on serverless platforms for large files.
    console.warn(
      "[runBackgroundMediaTranscript] Inngest dispatch failed, falling back to direct transcription:",
      dispatchError instanceof Error ? dispatchError.message : dispatchError,
    );
    await transcribeUploadedMedia(contentItemId);
  }
}
