"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const TARGET_AUDIO_BITRATE = "32k";
const TARGET_AUDIO_SAMPLE_RATE = "16000";
const TARGET_SEGMENT_DURATION_SECONDS = 45 * 60;
const FFMPEG_CORE_VERSION = "0.12.10";

let ffmpegPromise: Promise<FFmpeg> | null = null;

export type OptimizedMediaAsset = {
  file: File;
  bytes: number;
  contentType: string;
};

export type OptimizedMediaResult = {
  assets: OptimizedMediaAsset[];
  metadata: {
    optimization_strategy: "browser_audio_segments";
    target_audio_bitrate: string;
    target_audio_sample_rate: string;
    segment_duration_seconds: number;
    original_file_size: number;
  };
};

function sanitizeBaseName(fileName: string): string {
  return (fileName.replace(/\.[^.]+$/, "") || "media")
    .replace(/[^\w.\-()+ ]/g, "_")
    .trim();
}

async function getBrowserFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
        workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript"),
      });

      return ffmpeg;
    })();
  }

  return ffmpegPromise;
}

export function shouldOptimizeMediaForTranscript(file: File): boolean {
  return /\.(mp4|mp3)$/i.test(file.name);
}

export async function optimizeMediaForTranscript(
  file: File,
  onStageChange?: (message: string) => void,
): Promise<OptimizedMediaResult> {
  const ffmpeg = await getBrowserFfmpeg();
  const safeBaseName = sanitizeBaseName(file.name);
  const inputName = `input${file.name.match(/\.[^.]+$/)?.[0] ?? ".bin"}`;
  const outputPattern = "segment-%03d.mp3";

  onStageChange?.("Preparing media for transcript-first upload...");
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onStageChange?.("Extracting and compressing audio locally...");
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vn",
    "-map_metadata",
    "-1",
    "-ac",
    "1",
    "-ar",
    TARGET_AUDIO_SAMPLE_RATE,
    "-b:a",
    TARGET_AUDIO_BITRATE,
    "-f",
    "segment",
    "-segment_time",
    String(TARGET_SEGMENT_DURATION_SECONDS),
    "-reset_timestamps",
    "1",
    outputPattern,
  ]);

  const files = await ffmpeg.listDir("/");
  const segmentNames = files
    .map((entry) => entry.name)
    .filter((name) => /^segment-\d+\.mp3$/.test(name))
    .sort((a, b) => a.localeCompare(b));

  if (segmentNames.length === 0) {
    throw new Error("Could not prepare this media file for transcription.");
  }

  const assets: OptimizedMediaAsset[] = [];
  for (const [index, segmentName] of segmentNames.entries()) {
    const data = await ffmpeg.readFile(segmentName);
    if (!(data instanceof Uint8Array)) {
      throw new Error("Prepared media segment was not returned as binary data.");
    }

    const bytes = data;
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const outputFile = new File(
      [arrayBuffer],
      `${safeBaseName}.part-${String(index + 1).padStart(3, "0")}.mp3`,
      { type: "audio/mpeg" },
    );

    assets.push({
      file: outputFile,
      bytes: outputFile.size,
      contentType: outputFile.type || "audio/mpeg",
    });
  }

  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await Promise.all(segmentNames.map((name) => ffmpeg.deleteFile(name).catch(() => undefined)));

  return {
    assets,
    metadata: {
      optimization_strategy: "browser_audio_segments",
      target_audio_bitrate: TARGET_AUDIO_BITRATE,
      target_audio_sample_rate: TARGET_AUDIO_SAMPLE_RATE,
      segment_duration_seconds: TARGET_SEGMENT_DURATION_SECONDS,
      original_file_size: file.size,
    },
  };
}
