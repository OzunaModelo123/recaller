"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, CloudUpload, Link2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ingestContentFile, ingestContentUrl } from "@/app/dashboard/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const STATUS_ORDER = ["queued", "transcribing", "analyzing", "ready"] as const;

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
    setLastSuccessId(null);
    const fd = new FormData();
    fd.set("file", file);
    startFile(async () => {
      const result = await ingestContentFile(fd);
      if (!result.ok) {
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
            <p className="text-sm font-medium text-stone-700">Content added to your library.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link href={`/dashboard/content/${lastSuccessId}`}>View</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-stone-400 hover:text-stone-600" onClick={() => setLastSuccessId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Processing status */}
      {trackingId && (
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-800">Processing</p>
              <p className="mt-0.5 text-xs text-stone-400">
                {liveStatus === "queued" || liveStatus === "transcribing" || !liveStatus
                  ? "Background transcription via Inngest. Run `npx inngest-cli@latest dev` locally."
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
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50">
            <Link2 className="h-5 w-5 text-stone-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Paste a URL</h2>
            <p className="text-xs text-stone-400">YouTube, Vimeo, Loom, or any web article.</p>
          </div>
        </div>
        <form onSubmit={onSubmitUrl} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content-url" className="text-xs font-medium text-stone-500">
              URL
            </Label>
            <Input
              id="content-url"
              name="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPendingUrl}
              className="h-11 rounded-xl border-stone-200 bg-white px-4 transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
          </div>
          {urlError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{urlError}</p>
          )}
          <Button
            type="submit"
            disabled={isPendingUrl || !url.trim()}
            className="rounded-xl bg-stone-900 hover:bg-stone-800"
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
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50">
            <CloudUpload className="h-5 w-5 text-stone-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Upload a file</h2>
            <p className="text-xs text-stone-400">
              PDF, DOCX (instant), or MP4/MP3 (Whisper via Inngest). Max 500 MB.
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
                ? "border-stone-400 bg-stone-50"
                : "border-stone-200 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              <CloudUpload className="h-5 w-5 text-stone-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-stone-700">
              Drag and drop or click to browse
            </p>
            <p className="mt-1.5 text-xs text-stone-400">
              MP4 &middot; MP3 &middot; PDF &middot; DOCX
            </p>
          </div>
          {fileError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>
          )}
          {isPendingFile && (
            <p className="mt-3 flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
