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
import { Progress } from "@/components/ui/progress";
import {
  optimizeMediaForTranscript,
  shouldOptimizeMediaForTranscript,
} from "@/lib/content/clientMediaOptimizer";

const STATUS_ORDER = ["queued", "transcribing", "analyzing", "ready"] as const;
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;

function getResumableUploadEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  url.hostname = `${url.hostname.split(".")[0]}.storage.supabase.co`;
  url.pathname = "/storage/v1/upload/resumable";
  return url.toString();
}

function shouldUseResumableUpload(file: File): boolean {
  return file.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES;
}

function statusProgress(status: string): number {
  if (status === "failed") return 100;
  const i = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
  if (i < 0) return 0;
  return Math.round(((i + 1) / STATUS_ORDER.length) * 100);
}

export function ContentUploadForm() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [lastSuccessId, setLastSuccessId] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);
  const [isPendingUrl, startUrl] = useTransition();
  const [isPendingFile, startFile] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pollStatus = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("content_items").select("status").eq("id", id).maybeSingle();
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

  const handleFile = useCallback((file: File) => {
    setFileError(null);
    setFileStatus(null);
    setLastSuccessId(null);
    startFile(async () => {
      const prep = await prepareContentFileUpload(file.name, file.size);
      if (!prep.ok) {
        setFileError(prep.error);
        return;
      }

      const supabase = createClient();
      const uploadedAssets: Array<{
        path: string;
        bytes: number;
        contentType: string;
        kind: "source_file" | "transcript_audio_segment";
      }> = [];
      let upErr: { message: string } | null = null;
      const mediaNeedsOptimization = shouldOptimizeMediaForTranscript(file);
      const filesToUpload: Array<{
        file: File;
        path: string;
        bytes: number;
        contentType: string;
        kind: "source_file" | "transcript_audio_segment";
      }> = [];

      if (mediaNeedsOptimization) {
        try {
          const optimized = await optimizeMediaForTranscript(file, setFileStatus);
          filesToUpload.push(
            ...optimized.assets.map((asset, index) => ({
              file: asset.file,
              path: `${prep.storagePrefix}/transcript-audio/${String(index + 1).padStart(3, "0")}-${asset.file.name}`,
              bytes: asset.bytes,
              contentType: asset.contentType,
              kind: "transcript_audio_segment" as const,
            })),
          );
          setFileStatus("Uploading transcript-friendly audio...");
        } catch (error) {
          await abortContentFileUpload(prep.contentItemId);
          setFileError(
            error instanceof Error
              ? error.message
              : "Could not prepare this media file for upload.",
          );
          setFileStatus(null);
          return;
        }
      } else {
        filesToUpload.push({
          file,
          path: prep.storagePath,
          bytes: file.size,
          contentType: file.type || "application/octet-stream",
          kind: "source_file",
        });
        setFileStatus("Uploading...");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        await abortContentFileUpload(prep.contentItemId);
        setFileError("Your session expired. Please sign in again and retry the upload.");
        setFileStatus(null);
        return;
      }

      for (const item of filesToUpload) {
        if (shouldUseResumableUpload(item.file)) {
          try {
            await new Promise<void>((resolve, reject) => {
              const upload = new tus.Upload(item.file, {
                endpoint: getResumableUploadEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL!),
                chunkSize: 6 * 1024 * 1024,
                retryDelays: [0, 3000, 5000, 10000, 20000],
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                headers: {
                  authorization: `Bearer ${session.access_token}`,
                  "x-upsert": "false",
                },
                metadata: {
                  bucketName: "content-files",
                  objectName: item.path,
                  contentType: item.contentType,
                  cacheControl: "3600",
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
          } catch (error) {
            upErr = {
              message: error instanceof Error ? error.message : "Upload to storage failed.",
            };
          }
        } else {
          const { error } = await supabase.storage.from("content-files").upload(item.path, item.file, {
            contentType: item.contentType || undefined,
            upsert: false,
          });
          upErr = error ? { message: error.message } : null;
        }

        if (upErr) {
          break;
        }

        uploadedAssets.push({
          path: item.path,
          bytes: item.bytes,
          contentType: item.contentType,
          kind: item.kind,
        });
      }

      if (upErr) {
        await abortContentFileUpload(
          prep.contentItemId,
          uploadedAssets.map((asset) => asset.path),
        );
        setFileStatus(null);
        if (/maximum upload size|entity too large|payload too large|413/i.test(upErr.message)) {
          setFileError("Upload rejected by storage before the file reached the 2GB bucket limit.");
        } else if (/size|too large/i.test(upErr.message)) {
          setFileError(
            "Upload rejected (size limit). Files over 2GB are blocked by the storage bucket limit.",
          );
        } else {
          setFileError(upErr.message || "Upload to storage failed.");
        }
        return;
      }

      setFileStatus("Finalizing upload...");
      const result = await finalizeContentFileUpload(prep.contentItemId, uploadedAssets);
      if (!result.ok) {
        setFileStatus(null);
        setFileError(result.error);
        return;
      }
      if (result.pollStatus) {
        setTrackingId(result.contentItemId);
        setLiveStatus(null);
        await pollStatus(result.contentItemId);
      } else {
        setLastSuccessId(result.contentItemId);
      }
      setFileStatus(null);
    });
  }, [pollStatus]);

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

  return (
    <div className="space-y-6">
      {/* Success banner */}
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
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
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

      {/* Processing status */}
      {trackingId && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Processing</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {liveStatus === "queued" || liveStatus === "transcribing" || !liveStatus
                  ? "Background transcription is running for this media file."
                  : "Transcription complete."}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                liveStatus === "ready"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : liveStatus === "failed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {liveStatus ?? "queued"}
            </span>
          </div>
          <Progress value={statusProgress(liveStatus ?? "queued")} className="h-1.5 rounded-full" />
          <Button variant="outline" size="sm" className="rounded-lg" asChild>
            <Link href={`/dashboard/content/${trackingId}`}>Open item</Link>
          </Button>
        </div>
      )}

      {/* URL input */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-none">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
            <Link2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Paste a URL</h2>
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

      {/* File upload */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-none">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
            <CloudUpload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Upload a file</h2>
            <p className="text-xs text-muted-foreground">
              PDF and DOCX are extracted instantly. MP4 and MP3 are converted into transcript-ready
              audio, transcribed, and purged so only text stays in your library.
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card border border-border shadow-none">
              <CloudUpload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              Drag and drop or click to browse
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              MP4 &middot; MP3 &middot; PDF &middot; DOCX
            </p>
          </div>
          {fileError && (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {fileError}
            </p>
          )}
          {isPendingFile && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {fileStatus ?? "Uploading..."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
