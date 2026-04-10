import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { purgeContentSourceFile } from "@/lib/content/purgeContentSourceFile";
import { createAdminClient } from "@/lib/supabase/admin";

const OPENAI_TRANSCRIPTION_MAX_BYTES = 24 * 1024 * 1024;
const COMPRESSED_AUDIO_BITRATE = "64k";
const COMPRESSED_AUDIO_SAMPLE_RATE = "16000";

/** Files at or below this size skip client-side extraction; Whisper accepts MP4 directly. */
const WHISPER_DIRECT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Maximum number of chunks transcribed concurrently to balance speed vs. API rate limits. */
const TRANSCRIPTION_CONCURRENCY = 3;

type UploadedMediaAsset = {
  path: string;
  bytes?: number;
  contentType?: string;
  kind?: string;
};

export function canTranscribeUploadedAssetDirectly(asset: UploadedMediaAsset): boolean {
  const lowerPath = asset.path.toLowerCase();
  const normalizedType = asset.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (lowerPath.endsWith(".mp3") || lowerPath.endsWith(".mpeg") || lowerPath.endsWith(".mpga")) {
    return true;
  }

  if (lowerPath.endsWith(".m4a") || lowerPath.endsWith(".mp4") || lowerPath.endsWith(".wav")) {
    return true;
  }

  return normalizedType === "audio/mpeg" || normalizedType === "audio/mp4" || normalizedType === "audio/wav";
}

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

async function runBinary(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(ffprobe.path, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || "ffprobe failed"));
    });
  });

  const duration = Number.parseFloat(output);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine media duration for transcription");
  }
  return duration;
}

async function compressMediaToAudio(sourcePath: string, outputPath: string): Promise<void> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg is not available for media transcription");
  }

  await runBinary(ffmpegPath, [
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    COMPRESSED_AUDIO_SAMPLE_RATE,
    "-b:a",
    COMPRESSED_AUDIO_BITRATE,
    outputPath,
  ]);
}

async function splitAudioIntoChunks(audioPath: string, tempDir: string): Promise<string[]> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg is not available for media transcription");
  }

  const stats = await fs.stat(audioPath);
  if (stats.size <= OPENAI_TRANSCRIPTION_MAX_BYTES) {
    return [audioPath];
  }

  const durationSeconds = await getMediaDurationSeconds(audioPath);
  const targetChunkCount = Math.ceil(stats.size / OPENAI_TRANSCRIPTION_MAX_BYTES);
  const segmentDurationSeconds = Math.max(60, Math.ceil(durationSeconds / targetChunkCount));
  const chunkPattern = path.join(tempDir, "chunk-%03d.mp3");

  await runBinary(ffmpegPath, [
    "-y",
    "-i",
    audioPath,
    "-f",
    "segment",
    "-segment_time",
    String(segmentDurationSeconds),
    "-reset_timestamps",
    "1",
    "-c",
    "copy",
    chunkPattern,
  ]);

  const files = (await fs.readdir(tempDir))
    .filter((file) => /^chunk-\d+\.mp3$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(tempDir, file));

  if (files.length === 0) {
    throw new Error("No transcription chunks were produced for this media file");
  }

  return files;
}

async function transcribeChunk(openai: OpenAI, chunkPath: string, index: number): Promise<string> {
  const buffer = await fs.readFile(chunkPath);
  const file = await toFile(buffer, `chunk-${String(index + 1).padStart(3, "0")}.mp3`, {
    type: "audio/mpeg",
  });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text?.trim() ?? "";
}

async function transcribeAudioBuffer(
  openai: OpenAI,
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const file = await toFile(buffer, fileName, { type: contentType });
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text?.trim() ?? "";
}

function readUploadedAssets(metadata: unknown): UploadedMediaAsset[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const rawAssets = (metadata as { uploaded_assets?: unknown }).uploaded_assets;
  if (!Array.isArray(rawAssets)) {
    return [];
  }

  return rawAssets
    .map((asset) => {
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
        return null;
      }

      const value = asset as UploadedMediaAsset;
      return typeof value.path === "string" && value.path.trim() ? value : null;
    })
    .filter((asset): asset is UploadedMediaAsset => Boolean(asset));
}

async function purgeUploadedAssets(admin: ReturnType<typeof createAdminClient>, paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) {
    return;
  }

  const { error: removeError } = await admin.storage.from("content-files").remove(uniquePaths);
  if (removeError) {
    throw new Error(removeError.message);
  }
}

/**
 * Run up to `limit` async tasks concurrently, preserving result order.
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function transcribeMediaBuffer(
  openai: OpenAI,
  buffer: Buffer,
  originalBasename: string,
): Promise<{ text: string; chunkCount: number }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "recaller-transcribe-"));
  const sourcePath = path.join(tempDir, originalBasename);
  const compressedAudioPath = path.join(tempDir, "normalized-audio.mp3");

  try {
    await fs.writeFile(sourcePath, buffer);

    // Small files that Whisper can accept directly skip the ffmpeg compression step
    const stats = await fs.stat(sourcePath);
    const isWhisperCompatible =
      stats.size <= WHISPER_DIRECT_UPLOAD_MAX_BYTES &&
      canTranscribeUploadedAssetDirectly({ path: originalBasename });

    let chunks: string[];

    if (isWhisperCompatible) {
      // Whisper handles this directly — no ffmpeg needed
      chunks = [sourcePath];
    } else {
      await compressMediaToAudio(sourcePath, compressedAudioPath);
      chunks = await splitAudioIntoChunks(compressedAudioPath, tempDir);
    }

    // Transcribe chunks concurrently (up to TRANSCRIPTION_CONCURRENCY at a time)
    const transcripts = await mapConcurrent(
      chunks,
      TRANSCRIPTION_CONCURRENCY,
      async (chunkPath, index) => transcribeChunk(openai, chunkPath, index),
    );

    const merged = transcripts.filter(Boolean).join("\n\n").trim();
    if (!merged) {
      throw new Error("Whisper returned empty text");
    }

    return {
      text: merged,
      chunkCount: chunks.length,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Inngest fan-out / fan-in helpers
// ---------------------------------------------------------------------------

export type TranscriptionAssetInfo = {
  path: string;
  bytes?: number;
  contentType?: string;
  kind?: string;
  index: number;
};

export type TranscriptionPlan = {
  contentItemId: string;
  assets: TranscriptionAssetInfo[];
  filePath: string | null;
  baseMeta: Record<string, unknown>;
  /** "segmented" = multiple pre-extracted audio segments; "single" = one file to download + process */
  mode: "segmented" | "single";
};

/**
 * Step 1 (Inngest fan-out): Load the content item and determine what needs transcribing.
 */
export async function getTranscriptionPlan(contentItemId: string): Promise<TranscriptionPlan> {
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

  const uploadedAssets = readUploadedAssets(item.metadata);

  if (uploadedAssets.some((asset) => asset.kind === "transcript_audio_segment")) {
    return {
      contentItemId,
      assets: uploadedAssets.map((asset, index) => ({ ...asset, index })),
      filePath: item.file_path,
      baseMeta,
      mode: "segmented",
    };
  }

  // Single file — return one "asset" pointing at the file_path
  return {
    contentItemId,
    assets: [
      {
        path: item.file_path,
        kind: "source_file",
        index: 0,
      },
    ],
    filePath: item.file_path,
    baseMeta,
    mode: "single",
  };
}

/**
 * Step 2 (Inngest parallel step): Transcribe a single asset and return the text.
 * Each asset is processed independently so Inngest can fan-out across workers.
 */
export async function transcribeSingleAsset(asset: TranscriptionAssetInfo): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const openai = new OpenAI({ apiKey });
  const admin = createAdminClient();

  const { data: assetBlob, error: assetError } = await admin.storage
    .from("content-files")
    .download(asset.path);

  if (assetError || !assetBlob) {
    throw new Error(assetError?.message ?? `Storage download failed for ${asset.path}`);
  }

  const assetBuffer = Buffer.from(await assetBlob.arrayBuffer());
  const assetName =
    asset.path.split("/").pop() || `segment-${String(asset.index + 1).padStart(3, "0")}.bin`;

  if (
    assetBuffer.byteLength <= OPENAI_TRANSCRIPTION_MAX_BYTES &&
    canTranscribeUploadedAssetDirectly(asset)
  ) {
    return transcribeAudioBuffer(
      openai,
      assetBuffer,
      assetName,
      asset.contentType?.split(";")[0]?.trim() || guessMimeAndName(assetName).mime,
    );
  }

  const result = await transcribeMediaBuffer(openai, assetBuffer, assetName);
  return result.text;
}

/**
 * Step 3 (Inngest fan-in): Merge transcript parts, save to DB, and purge storage.
 */
export async function finalizeTranscription(
  contentItemId: string,
  transcriptParts: string[],
  plan: TranscriptionPlan,
): Promise<void> {
  const admin = createAdminClient();

  const text = transcriptParts.filter(Boolean).join("\n\n").trim();
  if (!text) {
    await admin
      .from("content_items")
      .update({
        status: "failed",
        metadata: { ...plan.baseMeta, error: "Whisper returned empty text" },
      })
      .eq("id", contentItemId);
    throw new Error("Whisper returned empty text");
  }

  const { error: updateError } = await admin
    .from("content_items")
    .update({
      transcript: text,
      status: "ready",
      metadata: {
        ...plan.baseMeta,
        whisper: true,
        transcription_chunks: transcriptParts.length,
      },
    })
    .eq("id", contentItemId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  // Purge all uploaded media from storage — only the transcript text stays
  if (plan.mode === "segmented") {
    await purgeUploadedAssets(
      admin,
      plan.assets.map((asset) => asset.path),
    );
    const { error: clearPathError } = await admin
      .from("content_items")
      .update({ file_path: null })
      .eq("id", contentItemId);
    if (clearPathError) {
      throw new Error(clearPathError.message);
    }
  } else {
    await purgeContentSourceFile(admin, contentItemId, { throwOnStorageError: true });
  }
}

// ---------------------------------------------------------------------------
// Legacy all-in-one function (still used by contentTranscriptService.ts `after()` path)
// ---------------------------------------------------------------------------

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
    const openai = new OpenAI({ apiKey });
    const uploadedAssets = readUploadedAssets(item.metadata);

    let text = "";
    let chunkCount = 0;

    if (uploadedAssets.some((asset) => asset.kind === "transcript_audio_segment")) {
      // Transcribe all uploaded audio segments concurrently
      const transcriptParts = await mapConcurrent(
        uploadedAssets,
        TRANSCRIPTION_CONCURRENCY,
        async (asset, index) => {
          const { data: assetBlob, error: assetError } = await admin.storage
            .from("content-files")
            .download(asset.path);

          if (assetError || !assetBlob) {
            throw new Error(assetError?.message ?? `Storage download failed for ${asset.path}`);
          }

          const assetBuffer = Buffer.from(await assetBlob.arrayBuffer());
          const assetName =
            asset.path.split("/").pop() || `segment-${String(index + 1).padStart(3, "0")}.bin`;

          return assetBuffer.byteLength <= OPENAI_TRANSCRIPTION_MAX_BYTES &&
            canTranscribeUploadedAssetDirectly(asset)
            ? transcribeAudioBuffer(
              openai,
              assetBuffer,
              assetName,
              asset.contentType?.split(";")[0]?.trim() || guessMimeAndName(assetName).mime,
            )
            : transcribeMediaBuffer(openai, assetBuffer, assetName).then((r) => r.text);
        },
      );

      text = transcriptParts.filter(Boolean).join("\n\n").trim();
      chunkCount = uploadedAssets.length;
      if (!text) {
        throw new Error("Whisper returned empty text");
      }
    } else {
      const { data: blob, error: downloadError } = await admin.storage
        .from("content-files")
        .download(item.file_path);
      if (downloadError || !blob) {
        throw new Error(downloadError?.message ?? "Storage download failed");
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      const { basename } = guessMimeAndName(item.file_path);
      const result = await transcribeMediaBuffer(openai, buffer, basename);
      text = result.text;
      chunkCount = result.chunkCount;
    }

    const { error: updateError } = await admin
      .from("content_items")
      .update({
        transcript: text,
        status: "ready",
        metadata: { ...baseMeta, whisper: true, transcription_chunks: chunkCount },
      })
      .eq("id", contentItemId);
    if (updateError) {
      throw new Error(updateError.message);
    }

    if (uploadedAssets.length > 0) {
      await purgeUploadedAssets(
        admin,
        uploadedAssets.map((asset) => asset.path),
      );
      const { error: clearPathError } = await admin
        .from("content_items")
        .update({ file_path: null })
        .eq("id", contentItemId);
      if (clearPathError) {
        throw new Error(clearPathError.message);
      }
    } else {
      await purgeContentSourceFile(admin, contentItemId, { throwOnStorageError: true });
    }
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
