"use client";

import * as tus from "tus-js-client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, CloudUpload, Link2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  abortContentFileUpload,
  finalizeContentFileUpload,
  ingestContentUrl,
  prepareContentFileUpload,
} from "@/app/dashboard/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  needsServerSideFfmpeg,
  optimizeMediaForTranscript,
  shouldOptimizeMediaForTranscript,
} from "@/lib/content/clientMediaOptimizer";
import { getResumableUploadEndpoint } from "@/lib/supabase/resumableStorageUrl";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Supabase recommends TUS for files over 6MB, but the standard `storage.upload()` path often hits a
 * lower platform/request limit than `storage.buckets.file_size_limit` (e.g. 50MB on the REST API).
 * Using resumable uploads for every object keeps behavior consistent and avoids false "2GB bucket"
 * errors on large MP3s or multi-part transcript audio.
 *
 * @see https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim() || "application/octet-stream";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1_073_741_824) {
    const mb = bytes / 1_048_576;
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
  }
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

function statusProgress(status: string | null): number {
  switch (status) {
    case "queued":
      return 15;
    case "transcribing":
      return 50;
    case "analyzing":
      return 80;
    case "ready":
    case "failed":
      return 100;
    default:
      return 10;
  }
}

type StepState = "completed" | "active" | "pending" | "failed";

function getProcessingSteps(
  status: string | null,
): Array<{ label: string; state: StepState }> {
  const s = status ?? "queued";
  return [
    { label: "Uploaded", state: "completed" },
    {
      label: "Transcribing",
      state:
        s === "queued" || s === "transcribing"
          ? "active"
          : s === "analyzing" || s === "ready"
            ? "completed"
            : "pending",
    },
    {
      label: "Ready",
      state:
        s === "ready"
          ? "completed"
          : s === "failed"
            ? "failed"
            : s === "analyzing"
              ? "active"
              : "pending",
    },
  ];
}

function getProcessingMessage(status: string | null): string {
  switch (status) {
    case "queued":
      return "Your content is queued for transcription...";
    case "transcribing":
      return "Transcribing your content with AI...";
    case "analyzing":
      return "Almost there — finalizing your content...";
    case "ready":
      return "Your content is ready!";
    case "failed":
      return "Something went wrong during processing.";
    default:
      return "Preparing your content...";
  }
}

function getTimeEstimate(fileName: string, fileSize: number): string {
  if (/\.(pdf|docx)$/i.test(fileName)) return "";
  if (fileSize < 10 * 1024 * 1024) return "This usually finishes in a few seconds.";
  if (fileSize < 50 * 1024 * 1024) return "This usually takes less than a minute.";
  if (fileSize < 200 * 1024 * 1024) return "Should be ready in a minute or two.";
  return "Larger files take a bit longer — but we're on it!";
}

function parseProgressPercent(message: string): number | null {
  const match = /(\d+)%/.exec(message);
  return match ? parseInt(match[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentUploadForm() {
  // URL state
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // File state
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeFile, setActiveFile] = useState<{
    name: string;
    size: number;
  } | null>(null);

  // Tracking state
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [lastSuccessId, setLastSuccessId] = useState<string | null>(null);

  // Transitions
  const [isPendingUrl, startUrl] = useTransition();
  const [isPendingFile, startFile] = useTransition();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Status polling ──────────────────────────────────────────────────────
  const pollStatus = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("content_items")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (data?.status) {
      setLiveStatus(data.status);
    }
  }, []);

  useEffect(() => {
    if (!trackingId) return;
    const id = trackingId;
    const initial = window.setTimeout(() => void pollStatus(id), 0);
    const interval = window.setInterval(() => void pollStatus(id), 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [trackingId, pollStatus]);

  useEffect(() => {
    if (liveStatus === "ready" || liveStatus === "failed") {
      const t = setTimeout(() => {
        setTrackingId(null);
        setLiveStatus(null);
      }, 8000);
      return () => clearTimeout(t);
    }
  }, [liveStatus]);

  // ── URL submission ──────────────────────────────────────────────────────
  function onSubmitUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlError(null);
    setLastSuccessId(null);
    startUrl(async () => {
      const result = await ingestContentUrl(url);
      if (!result.ok) {
        setUrlError(result.error);
        return;
      }
      if (result.pollStatus) {
        setTrackingId(result.contentItemId);
        setLiveStatus("queued");
      } else {
        setLastSuccessId(result.contentItemId);
      }
      setUrl("");
    });
  }

  // ── File upload ─────────────────────────────────────────────────────────
  const handleFile = useCallback(
    (file: File) => {
      setFileError(null);
      setFileStatus(null);
      setLastSuccessId(null);
      setActiveFile({ name: file.name, size: file.size });
      setUploadProgress(0);

      startFile(async () => {
        try {
          setFileStatus("Preparing your upload...");
          const prep = await prepareContentFileUpload(file.name, file.size);
          if (!prep.ok) {
            setFileError(prep.error);
            return;
          }
          setUploadProgress(5);

          const supabase = createClient();
          const uploadedAssets: Array<{
            path: string;
            bytes: number;
            contentType: string;
            kind: "source_file" | "transcript_audio_segment";
          }> = [];
          let upErr: { message: string } | null = null;

          // Determine upload strategy
          const serverFallback = needsServerSideFfmpeg(file);
          const mediaNeedsOptimization =
            !serverFallback && shouldOptimizeMediaForTranscript(file);

          const {
            data: { session: authSession },
          } = await supabase.auth.getSession();

          if (!authSession?.access_token) {
            await abortContentFileUpload(prep.contentItemId);
            setFileError(
              "Your session expired. Please sign in again and retry the upload.",
            );
            return;
          }

          const accessToken = authSession.access_token;
          setUploadProgress(8);

          type UploadItem = {
            file: File;
            path: string;
            bytes: number;
            contentType: string;
            kind: "source_file" | "transcript_audio_segment";
          };

          async function uploadStorageObject(
            item: UploadItem,
            onProgress?: (pct: number) => void,
          ): Promise<{ ok: true } | { ok: false; message: string }> {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!supabaseUrl?.trim()) {
              return { ok: false, message: "Missing NEXT_PUBLIC_SUPABASE_URL." };
            }
            if (!anonKey?.trim()) {
              return {
                ok: false,
                message: "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.",
              };
            }

            const typeForStorage = storageContentType(item.contentType);

            try {
              await new Promise<void>((resolve, reject) => {
                const upload = new tus.Upload(item.file, {
                  endpoint: getResumableUploadEndpoint(supabaseUrl),
                  chunkSize: TUS_CHUNK_SIZE_BYTES,
                  retryDelays: [0, 3000, 5000, 10000, 20000],
                  uploadDataDuringCreation: true,
                  removeFingerprintOnSuccess: true,
                  headers: {
                    authorization: `Bearer ${accessToken}`,
                    apikey: anonKey,
                    "x-upsert": "false",
                  },
                  metadata: {
                    bucketName: "content-files",
                    objectName: item.path,
                    contentType: typeForStorage,
                    cacheControl: "3600",
                  },
                  onProgress: (bytesUploaded, bytesTotal) => {
                    if (bytesTotal > 0) {
                      onProgress?.(
                        Math.round((bytesUploaded / bytesTotal) * 100),
                      );
                    }
                  },
                  onError: (error) => reject(error),
                  onSuccess: () => resolve(),
                });

                void upload.findPreviousUploads().then((previousUploads) => {
                  if (previousUploads[0]) {
                    upload.resumeFromPreviousUpload(previousUploads[0]);
                  }
                  upload.start();
                });
              });
              return { ok: true };
            } catch (error) {
              return {
                ok: false,
                message:
                  error instanceof Error
                    ? error.message
                    : "Upload to storage failed.",
              };
            }
          }

          const streamedPathsForAbort: string[] = [];
          let clientMeta: Record<string, unknown> | undefined;

          if (mediaNeedsOptimization) {
            // ── Client-side audio extraction + streaming upload ──
            try {
              setFileStatus("Extracting audio from your video...");
              setUploadProgress(10);

              await optimizeMediaForTranscript(
                file,
                (msg) => {
                  setFileStatus(msg);
                  const pct = parseProgressPercent(msg);
                  if (pct !== null) {
                    // Map extraction progress (0-100) to our bar (10-70)
                    setUploadProgress(10 + Math.round(pct * 0.6));
                  }
                },
                {
                  onStreamPart: async (part) => {
                    const item: UploadItem = {
                      file: part.file,
                      path: `${prep.storagePrefix}/transcript-audio/${String(part.index + 1).padStart(3, "0")}-${part.file.name}`,
                      bytes: part.bytes,
                      contentType: part.contentType,
                      kind: "transcript_audio_segment",
                    };
                    setFileStatus(
                      `Uploading audio part ${part.index + 1}...`,
                    );
                    setUploadProgress(
                      70 + Math.min(18, (part.index + 1) * 3),
                    );
                    const result = await uploadStorageObject(item);
                    if (!result.ok) {
                      throw new Error(result.message);
                    }
                    streamedPathsForAbort.push(item.path);
                    uploadedAssets.push({
                      path: item.path,
                      bytes: item.bytes,
                      contentType: item.contentType,
                      kind: item.kind,
                    });
                  },
                },
              );
            } catch (error) {
              await abortContentFileUpload(
                prep.contentItemId,
                streamedPathsForAbort,
              );
              setFileError(
                error instanceof Error
                  ? error.message
                  : "Could not prepare this media file for upload.",
              );
              return;
            }
          } else {
            // ── Direct upload (raw file: small MP4, MP3, PDF, DOCX, or server-side FFmpeg fallback) ──
            setFileStatus("Uploading your content...");
            setUploadProgress(10);

            if (serverFallback) {
              clientMeta = { optimization_strategy: "server_ffmpeg" };
            }

            const item: UploadItem = {
              file,
              path: prep.storagePath,
              bytes: file.size,
              contentType: file.type || "application/octet-stream",
              kind: "source_file",
            };

            const result = await uploadStorageObject(item, (pct) => {
              // Map TUS progress (0-100) to our bar (10-90)
              setUploadProgress(10 + Math.round(pct * 0.8));
            });

            if (!result.ok) {
              upErr = { message: result.message };
            } else {
              uploadedAssets.push({
                path: item.path,
                bytes: item.bytes,
                contentType: item.contentType,
                kind: item.kind,
              });
            }
          }

          if (upErr) {
            await abortContentFileUpload(
              prep.contentItemId,
              uploadedAssets.map((asset) => asset.path),
            );
            if (
              /maximum upload size|entity too large|payload too large|413/i.test(
                upErr.message,
              )
            ) {
              setFileError(
                `Storage rejected this upload (often a Supabase API or plan limit, not your bucket file_size_limit). ${upErr.message}`,
              );
            } else if (/size|too large/i.test(upErr.message)) {
              setFileError(
                `Upload rejected (size limit). If the file is under 2GB, check Supabase Dashboard → Storage → your bucket limits and project upload caps. ${upErr.message}`,
              );
            } else {
              setFileError(upErr.message || "Upload to storage failed.");
            }
            return;
          }

          setFileStatus("Finalizing...");
          setUploadProgress(92);

          const result = await finalizeContentFileUpload(
            prep.contentItemId,
            uploadedAssets,
            clientMeta,
          );
          if (!result.ok) {
            setFileError(result.error);
            return;
          }

          setUploadProgress(100);

          if (result.pollStatus) {
            setTrackingId(result.contentItemId);
            setLiveStatus(null);
            await pollStatus(result.contentItemId);
          } else {
            setLastSuccessId(result.contentItemId);
          }
        } finally {
          setActiveFile(null);
          setUploadProgress(0);
          setFileStatus(null);
        }
      });
    },
    [pollStatus],
  );

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  const processingSteps = getProcessingSteps(liveStatus);

  return (
    <>
      {/* Shimmer keyframe for progress bars */}
      <style>{`
        @keyframes recaller-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div className="space-y-6">
        {/* ── Success banner ── */}
        {lastSuccessId && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Content added to your library.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                asChild
              >
                <Link href={`/dashboard/content/${lastSuccessId}`}>View</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setLastSuccessId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Background processing panel ── */}
        {trackingId && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            {/* Step indicator */}
            <div className="flex items-center justify-center">
              {processingSteps.map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex items-center gap-1.5">
                    {step.state === "completed" ? (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </div>
                    ) : step.state === "active" ? (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      </div>
                    ) : step.state === "failed" ? (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <X className="h-3 w-3 text-red-600" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 shrink-0 rounded-full border-2 border-muted-foreground/20" />
                    )}
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        step.state === "completed"
                          ? "text-emerald-600"
                          : step.state === "active"
                            ? "text-primary"
                            : step.state === "failed"
                              ? "text-red-600"
                              : "text-muted-foreground/50"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {i < processingSteps.length - 1 && (
                    <div
                      className={`mx-3 h-px w-8 ${
                        step.state === "completed"
                          ? "bg-emerald-200"
                          : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="relative mt-5 h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
                  liveStatus === "ready"
                    ? "bg-emerald-500"
                    : liveStatus === "failed"
                      ? "bg-red-400"
                      : "bg-primary"
                }`}
                style={{ width: `${statusProgress(liveStatus)}%` }}
              />
              {liveStatus !== "ready" && liveStatus !== "failed" && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.2) 50%, transparent 75%)",
                    backgroundSize: "200% 100%",
                    animation: "recaller-shimmer 2s ease-in-out infinite",
                  }}
                />
              )}
            </div>

            {/* Status message */}
            <p
              className={`mt-4 text-sm ${
                liveStatus === "ready"
                  ? "font-medium text-emerald-600"
                  : liveStatus === "failed"
                    ? "font-medium text-red-600"
                    : "text-muted-foreground"
              }`}
            >
              {getProcessingMessage(liveStatus)}
            </p>

            {/* Navigate away note */}
            {liveStatus !== "ready" && liveStatus !== "failed" && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                💡 You can navigate away — processing continues in the
                background.
              </p>
            )}

            {/* View button */}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-lg"
              asChild
            >
              <Link href={`/dashboard/content/${trackingId}`}>
                {liveStatus === "ready" ? "View content →" : "Open item"}
              </Link>
            </Button>
          </div>
        )}

        {/* ── URL input ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
              <Link2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Paste a URL
              </h2>
              <p className="text-xs text-muted-foreground">
                YouTube, Vimeo, Loom, or any web article.
              </p>
            </div>
          </div>
          <form onSubmit={onSubmitUrl} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content-url">URL</Label>
              <Input
                id="content-url"
                name="url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isPendingUrl}
                className="h-11 rounded-xl"
              />
            </div>
            {urlError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {urlError}
              </p>
            )}
            <Button
              type="submit"
              disabled={isPendingUrl || !url.trim()}
              className="rounded-xl"
            >
              {isPendingUrl ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working...
                </>
              ) : (
                "Import from URL"
              )}
            </Button>
          </form>
        </div>

        {/* ── File upload ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
              <CloudUpload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Upload a file
              </h2>
              <p className="text-xs text-muted-foreground">
                PDF and DOCX are processed instantly. MP4 and MP3 are
                transcribed automatically &mdash; you can navigate away while we
                work.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mp3,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/mpeg,video/mp4"
              className="sr-only"
              onChange={onFileInputChange}
            />

            {isPendingFile && activeFile ? (
              /* ── Upload progress panel ── */
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.02] px-6 py-12 text-center">
                {/* Animated icon */}
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
                    <CloudUpload className="h-6 w-6 text-primary" />
                  </div>
                  {uploadProgress < 100 && (
                    <div className="absolute -inset-1 animate-pulse rounded-2xl border border-primary/10" />
                  )}
                </div>

                {/* File info */}
                <p className="mt-4 max-w-[300px] truncate text-sm font-medium text-foreground">
                  {activeFile.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatFileSize(activeFile.size)}
                </p>

                {/* Progress bar with shimmer */}
                <div className="relative mt-5 h-2 w-full max-w-xs rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.2) 50%, transparent 75%)",
                        backgroundSize: "200% 100%",
                        animation:
                          "recaller-shimmer 2s ease-in-out infinite",
                      }}
                    />
                  )}
                </div>

                {/* Percentage */}
                {uploadProgress > 0 && (
                  <p className="mt-2 text-xs font-medium tabular-nums text-primary">
                    {uploadProgress}%
                  </p>
                )}

                {/* Stage message */}
                <p className="mt-3 text-sm text-muted-foreground">
                  {fileStatus ?? "Preparing..."}
                </p>

                {/* Time estimate */}
                {getTimeEstimate(activeFile.name, activeFile.size) && (
                  <p className="mt-1.5 text-xs text-muted-foreground/60">
                    {getTimeEstimate(activeFile.name, activeFile.size)}
                  </p>
                )}
              </div>
            ) : (
              /* ── Drag & drop area ── */
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all ${
                  isDragging
                    ? "border-primary/40 bg-card"
                    : "border-border bg-transparent hover:border-border/80 hover:bg-card"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-none">
                  <CloudUpload className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  Drag and drop or click to browse
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  MP4 &middot; MP3 &middot; PDF &middot; DOCX
                </p>
              </div>
            )}

            {fileError && (
              <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {fileError}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
