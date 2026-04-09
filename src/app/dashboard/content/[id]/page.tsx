import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, FileText } from "lucide-react";
import { PageHeader } from "@/components/design/page-header";
import { GeneratePlanButton } from "@/components/dashboard/generate-plan-button";
import { createClient } from "@/lib/supabase/server";
import { ContentDeleteButton } from "../content-delete-button";

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

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    redirect("/login");
  }

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const { data: item } = await supabase
    .from("content_items")
    .select("id, title, source_type, source_url, status, transcript, created_at, metadata, org_id")
    .eq("id", id)
    .eq("org_id", profile.org_id)
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
      ? "bg-chart-1/12 text-chart-1 border-chart-1/25"
      : item.status === "failed"
        ? "bg-destructive/10 text-destructive border-destructive/25"
        : "bg-chart-3/12 text-chart-3 border-chart-3/30";

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/dashboard/content"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Content library
        </Link>

        <PageHeader title={item.title} />

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium capitalize ${statusColor}`}
          >
            {item.status}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            {created}
          </span>
          <span className="rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {item.source_type}
          </span>
          {isAdmin ? (
            <ContentDeleteButton
              contentItemId={item.id}
              title={item.title}
              redirectToLibrary
            />
          ) : null}
        </div>

        {item.source_url && (
          <a
            href={item.source_url}
            className="inline-flex max-w-full items-center gap-1.5 break-all text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
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
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/15 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Transcript</h2>
          </div>
          <GeneratePlanButton
            contentItemId={item.id}
            disabled={item.status !== "ready" || !item.transcript}
          />
        </div>
        <div className="px-6 py-5">
          {item.transcript ? (
            <pre className="max-h-[min(70vh,720px)] overflow-auto whitespace-pre-wrap rounded-xl bg-card p-5 font-mono text-[13px] leading-relaxed text-muted-foreground">
              {item.transcript}
            </pre>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">
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
