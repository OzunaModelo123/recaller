import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, FileText } from "lucide-react";
import { GeneratePlanButton } from "@/components/dashboard/generate-plan-button";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function ContentDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: item } = await supabase
    .from("content_items")
    .select("id, title, source_type, source_url, status, transcript, created_at, metadata")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    notFound();
  }

  const created = new Date(item.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const statusColor =
    item.status === "ready"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : item.status === "failed"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/content"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Content library
        </Link>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-stone-900">
          {item.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium ${statusColor}`}>
            {item.status}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-400">
            <Clock className="h-3 w-3" />
            {created}
          </span>
          <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
            {item.source_type}
          </span>
        </div>

        {item.source_url && (
          <a
            href={item.source_url}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-500 underline underline-offset-2 transition-colors hover:text-stone-800"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {item.source_url.length > 60
              ? item.source_url.slice(0, 60) + "..."
              : item.source_url}
          </a>
        )}
      </div>

      {/* Transcript */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-stone-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-800">Transcript</h2>
          </div>
          <GeneratePlanButton
            contentItemId={item.id}
            disabled={item.status !== "ready" || !item.transcript}
          />
        </div>
        <div className="px-6 py-5">
          {item.transcript ? (
            <pre className="max-h-[min(70vh,720px)] overflow-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-5 font-mono text-[13px] leading-relaxed text-stone-700">
              {item.transcript}
            </pre>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-50">
                <FileText className="h-5 w-5 text-stone-300" />
              </div>
              <p className="mt-4 max-w-sm text-sm text-stone-400">
                {item.status === "queued" || item.status === "transcribing"
                  ? "Transcript is not ready yet. If this is an audio or video upload, start the Inngest dev server and wait for Whisper to finish."
                  : item.status === "failed"
                    ? "Processing failed. Check metadata in the database or try re-uploading."
                    : "No transcript stored for this item."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
