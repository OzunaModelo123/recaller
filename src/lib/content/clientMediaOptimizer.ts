"use client";

const RECORDER_TIMESLICE_MS = 30_000;
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

export type OptimizedMediaResult = {
  assets: OptimizedMediaAsset[];
  metadata: {
    optimization_strategy: "browser_audio_segments" | "browser_media_recorder_audio_chunks";
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

export function shouldOptimizeMediaForTranscript(file: File): boolean {
  return /\.(mp4|mp3)$/i.test(file.name);
}

export async function optimizeMediaForTranscript(
  file: File,
  onStageChange?: (message: string) => void,
): Promise<OptimizedMediaResult> {
  try {
    const mimeType = getSupportedRecorderMimeType();
    if (!mimeType) {
      throw new Error("This browser does not support local audio capture for media uploads.");
    }

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

    onStageChange?.("Extracting audio locally for transcript-first upload...");
    const sourceStream = getCaptureStream(mediaElement);
    const audioTracks = sourceStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track was found in this media file.");
    }

    const audioStream = new MediaStream(audioTracks);
    const recordedChunks: Blob[] = [];
    const recorder = new MediaRecorder(audioStream, { mimeType });

    const stopPromise = new Promise<void>((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
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

    recorder.start(RECORDER_TIMESLICE_MS);
    await mediaElement.play();
    await stopPromise;
    sourceStream.getTracks().forEach((track) => track.stop());
    mediaElement.pause();
    mediaElement.remove();
    URL.revokeObjectURL(objectUrl);

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
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not prepare this media file for upload: ${message}`);
  }
}
