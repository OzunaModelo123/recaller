"use client";

/**
 * Faster-than-real-time extraction: decode + capture while the media element plays
 * above 1×. Capped to avoid unstable decoders; pitch preservation helps Whisper.
 */
const EXTRACTION_PLAYBACK_RATE = 4;

/** Smaller slices → first storage upload starts sooner while capture continues. */
const RECORDER_TIMESLICE_MS = 15_000;

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

export type OptimizedMediaAsset = {
  file: File;
  bytes: number;
  contentType: string;
};

export type StreamedMediaPart = {
  index: number;
  file: File;
  contentType: string;
  bytes: number;
};

export type OptimizeMediaOptions = {
  /**
   * When set, each recorded slice is emitted as soon as the browser provides it so the
   * caller can upload while extraction continues (overlaps network with capture).
   */
  onStreamPart?: (part: StreamedMediaPart) => Promise<void>;
};

export type OptimizedMediaResult = {
  assets: OptimizedMediaAsset[];
  metadata: {
    optimization_strategy: "webcodecs_audio_segments" | "browser_audio_segments" | "browser_media_recorder_audio_chunks";
    target_audio_bitrate: string;
    target_audio_sample_rate: string;
    segment_duration_seconds: number;
    original_file_size: number;
    extraction_playback_rate: number;
    streaming_upload: boolean;
    streamed_part_count?: number;
  };
};

function sanitizeBaseName(fileName: string): string {
  return (fileName.replace(/\.[^.]+$/, "") || "media")
    .replace(/[^\w.\-()+ ]/g, "_")
    .trim();
}

function getSupportedRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  for (const mimeType of PREFERRED_AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

function createMediaElement(file: File): HTMLMediaElement {
  if (/\.(mp4|mov|m4v|webm)$/i.test(file.name) || file.type.startsWith("video/")) {
    return document.createElement("video");
  }

  return document.createElement("audio");
}

function getCaptureStream(element: HTMLMediaElement): MediaStream {
  const capturable = element as HTMLMediaElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };

  if (typeof capturable.captureStream === "function") {
    return capturable.captureStream();
  }

  if (typeof capturable.mozCaptureStream === "function") {
    return capturable.mozCaptureStream();
  }

  throw new Error("This browser cannot extract audio from uploaded media files.");
}

function applyFastPlayback(mediaElement: HTMLMediaElement): number {
  const rate = Math.min(4, Math.max(1, EXTRACTION_PLAYBACK_RATE));
  mediaElement.playbackRate = rate;
  mediaElement.defaultPlaybackRate = rate;

  if (mediaElement instanceof HTMLVideoElement) {
    const v = mediaElement as HTMLVideoElement & { preservesPitch?: boolean };
    if ("preservesPitch" in v) {
      try {
        v.preservesPitch = true;
      } catch {
        /* optional */
      }
    }
  }

  return rate;
}

/**
 * Small MP4s (under 25 MB) are accepted by Whisper directly — no browser extraction needed.
 * Only files above this threshold go through the MediaRecorder / WebCodecs path.
 */
const SMALL_FILE_BYPASS_BYTES = 25 * 1024 * 1024;

export function shouldOptimizeMediaForTranscript(file: File): boolean {
  if (!/\.mp4$/i.test(file.name)) return false;
  // Small MP4s can be sent straight to Whisper without extracting audio
  return file.size > SMALL_FILE_BYPASS_BYTES;
}

/**
 * Returns `true` when the browser cannot handle client-side audio extraction from
 * a large MP4 and the file should be uploaded raw for server-side FFmpeg processing.
 *
 * This is the "last resort" fallback — used only when:
 * - The MP4 is too large for Whisper to accept directly (> 25 MB)
 * - WebCodecs API is unavailable
 * - MediaRecorder with a supported MIME type is unavailable
 */
export function needsServerSideFfmpeg(file: File): boolean {
  if (!/\.mp4$/i.test(file.name)) return false;

  // Small MP4s (≤ 25 MB) go to Whisper directly — no extraction step needed
  if (file.size <= SMALL_FILE_BYPASS_BYTES) return false;

  // WebCodecs is the preferred extraction path
  const hasWebCodecs =
    typeof globalThis.AudioDecoder === "function" &&
    typeof globalThis.AudioEncoder === "function" &&
    typeof globalThis.EncodedAudioChunk === "function";
  if (hasWebCodecs) return false;

  // MediaRecorder is the secondary extraction path
  const hasMediaRecorder =
    typeof MediaRecorder !== "undefined" &&
    PREFERRED_AUDIO_MIME_TYPES.some((t) => MediaRecorder.isTypeSupported(t));
  if (hasMediaRecorder) return false;

  return true;
}

export async function optimizeMediaForTranscript(
  file: File,
  onStageChange?: (message: string) => void,
  options?: OptimizeMediaOptions,
): Promise<OptimizedMediaResult> {
  // Try WebCodecs first (10-50× faster than real-time playback)
  try {
    const { isWebCodecsSupported, extractAudioWithWebCodecs } = await import(
      "@/lib/content/webCodecsAudioExtractor"
    );

    if (isWebCodecsSupported()) {
      onStageChange?.("Extracting audio (fast mode)...");
      const safeBaseName = sanitizeBaseName(file.name);
      const onStreamPart = options?.onStreamPart;

      const result = await extractAudioWithWebCodecs(file, (progress) => {
        if (progress.stage === "demuxing") {
          onStageChange?.(`Reading MP4 container... ${progress.percent}%`);
        } else if (progress.stage === "encoding") {
          onStageChange?.(`Encoding audio... ${progress.percent}%`);
        }
      });

      const assets: OptimizedMediaAsset[] = [];
      let streamIndex = 0;

      for (const chunk of result.chunks) {
        const outputFile = new File(
          [chunk.blob],
          `${safeBaseName}.part-${String(chunk.index + 1).padStart(3, "0")}.webm`,
          { type: "audio/webm;codecs=opus" },
        );

        if (onStreamPart) {
          onStageChange?.(`Uploading audio part ${chunk.index + 1}...`);
          await onStreamPart({
            index: streamIndex,
            file: outputFile,
            contentType: outputFile.type,
            bytes: outputFile.size,
          });
          streamIndex++;
        } else {
          assets.push({
            file: outputFile,
            bytes: outputFile.size,
            contentType: outputFile.type,
          });
        }
      }

      onStageChange?.("Audio extraction complete.");

      return {
        assets,
        metadata: {
          optimization_strategy: "webcodecs_audio_segments",
          target_audio_bitrate: "64kbps",
          target_audio_sample_rate: "16000",
          segment_duration_seconds: 0,
          original_file_size: file.size,
          extraction_playback_rate: 0, // not applicable for WebCodecs
          streaming_upload: Boolean(onStreamPart),
          streamed_part_count: onStreamPart ? streamIndex : undefined,
        },
      };
    }
  } catch (webCodecsError) {
    // WebCodecs failed or unsupported — fall back to MediaRecorder
    console.warn(
      "[clientMediaOptimizer] WebCodecs extraction failed, falling back to MediaRecorder:",
      webCodecsError instanceof Error ? webCodecsError.message : webCodecsError,
    );
  }

  // Fallback: MediaRecorder-based extraction (plays video at accelerated speed)
  return optimizeMediaWithMediaRecorder(file, onStageChange, options);
}

/**
 * Legacy MediaRecorder-based extraction. Plays the media at accelerated speed
 * and captures the audio track. Used as fallback when WebCodecs is unavailable.
 */
async function optimizeMediaWithMediaRecorder(
  file: File,
  onStageChange?: (message: string) => void,
  options?: OptimizeMediaOptions,
): Promise<OptimizedMediaResult> {
  try {
    const mimeType = getSupportedRecorderMimeType();
    if (!mimeType) {
      throw new Error("This browser does not support local audio capture for media uploads.");
    }

    const onStreamPart = options?.onStreamPart;
    const safeBaseName = sanitizeBaseName(file.name);
    const extension = mimeType.includes("mp4") ? "m4a" : "webm";
    const objectUrl = URL.createObjectURL(file);
    const mediaElement = createMediaElement(file);
    mediaElement.preload = "auto";
    mediaElement.muted = true;
    mediaElement.defaultMuted = true;
    if (mediaElement instanceof HTMLVideoElement) {
      mediaElement.playsInline = true;
    }
    mediaElement.src = objectUrl;
    mediaElement.style.position = "fixed";
    mediaElement.style.width = "1px";
    mediaElement.style.height = "1px";
    mediaElement.style.opacity = "0";
    mediaElement.style.pointerEvents = "none";
    mediaElement.style.left = "-9999px";
    document.body.appendChild(mediaElement);

    await new Promise<void>((resolve, reject) => {
      const onLoadedMetadata = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("The browser could not read this media file."));
      };
      const cleanup = () => {
        mediaElement.removeEventListener("loadedmetadata", onLoadedMetadata);
        mediaElement.removeEventListener("error", onError);
      };

      mediaElement.addEventListener("loadedmetadata", onLoadedMetadata);
      mediaElement.addEventListener("error", onError);
    });

    const appliedRate = applyFastPlayback(mediaElement);
    onStageChange?.(
      `Extracting audio locally (~${appliedRate}× speed) for transcript-first upload...`,
    );

    const sourceStream = getCaptureStream(mediaElement);
    const audioTracks = sourceStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track was found in this media file.");
    }

    const audioStream = new MediaStream(audioTracks);
    const recordedChunks: Blob[] = [];
    const recorder = new MediaRecorder(audioStream, { mimeType });

    let streamIndex = 0;
    let streamTail = Promise.resolve();

    const enqueueStreamPart = (blob: Blob) => {
      const idx = streamIndex;
      streamIndex += 1;
      const outputFile = new File(
        [blob],
        `${safeBaseName}.part-${String(idx + 1).padStart(3, "0")}.${extension}`,
        { type: blob.type || mimeType },
      );
      streamTail = streamTail
        .then(() =>
          onStreamPart!({
            index: idx,
            file: outputFile,
            contentType: outputFile.type || mimeType,
            bytes: outputFile.size,
          }),
        )
        .catch((err: unknown) => {
          try {
            mediaElement.pause();
            if (recorder.state !== "inactive") {
              recorder.stop();
            }
          } catch {
            /* ignore */
          }
          throw err;
        });
    };

    const stopPromise = new Promise<void>((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          if (onStreamPart) {
            enqueueStreamPart(event.data);
          } else {
            recordedChunks.push(event.data);
          }
        }
      });
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.addEventListener(
        "error",
        () => reject(new Error("The browser audio recorder failed during media preparation.")),
        { once: true },
      );
      mediaElement.addEventListener(
        "timeupdate",
        () => {
          if (mediaElement.duration > 0) {
            const progress = Math.min(
              99,
              Math.round((mediaElement.currentTime / mediaElement.duration) * 100),
            );
            onStageChange?.(`Extracting audio locally... ${progress}%`);
          }
        },
      );
      mediaElement.addEventListener(
        "ended",
        () => {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        },
        { once: true },
      );
      mediaElement.addEventListener(
        "error",
        () => reject(new Error("Playback failed during local media preparation.")),
        { once: true },
      );
    });

    try {
      recorder.start(RECORDER_TIMESLICE_MS);
      await mediaElement.play();
      await stopPromise;
      if (onStreamPart) {
        await streamTail;
      }
    } finally {
      sourceStream.getTracks().forEach((track) => track.stop());
      mediaElement.pause();
      mediaElement.remove();
      URL.revokeObjectURL(objectUrl);
    }

    if (onStreamPart) {
      if (streamIndex === 0) {
        throw new Error("No transcript-ready audio chunks were created from this media file.");
      }

      return {
        assets: [],
        metadata: {
          optimization_strategy: "browser_media_recorder_audio_chunks",
          target_audio_bitrate: "browser-default",
          target_audio_sample_rate: "browser-default",
          segment_duration_seconds: RECORDER_TIMESLICE_MS / 1000,
          original_file_size: file.size,
          extraction_playback_rate: appliedRate,
          streaming_upload: true,
          streamed_part_count: streamIndex,
        },
      };
    }

    if (recordedChunks.length === 0) {
      throw new Error("No transcript-ready audio chunks were created from this media file.");
    }

    const assets: OptimizedMediaAsset[] = [];
    for (const [index, chunk] of recordedChunks.entries()) {
      if (chunk.size === 0) {
        continue;
      }

      const outputFile = new File(
        [chunk],
        `${safeBaseName}.part-${String(index + 1).padStart(3, "0")}.${extension}`,
        { type: chunk.type || mimeType },
      );

      assets.push({
        file: outputFile,
        bytes: outputFile.size,
        contentType: outputFile.type || mimeType,
      });
    }

    if (assets.length === 0) {
      throw new Error("All generated audio chunks were empty.");
    }

    return {
      assets,
      metadata: {
        optimization_strategy: "browser_media_recorder_audio_chunks",
        target_audio_bitrate: "browser-default",
        target_audio_sample_rate: "browser-default",
        segment_duration_seconds: RECORDER_TIMESLICE_MS / 1000,
        original_file_size: file.size,
        extraction_playback_rate: appliedRate,
        streaming_upload: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not prepare this media file for upload: ${message}`);
  }
}
