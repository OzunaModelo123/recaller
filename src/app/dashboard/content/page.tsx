import Link from "next/link";
import { redirect } from "next/navigation";
import { FileVideo, Plus, Search, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SOURCE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "loom", label: "Loom" },
  { value: "web_article", label: "Article" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "mp4", label: "MP4" },
  { value: "mp3", label: "MP3" },
] as const;

function statusStyle(status: string) {
  switch (status) {
    case "ready":
      return "bg-chart-1/12 text-chart-1 border-chart-1/25";
    case "failed":
      return "bg-destructive/10 text-destructive border-destructive/25";
    case "queued":
    case "transcribing":
    case "analyzing":
      return "bg-chart-3/12 text-chart-3 border-chart-3/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function sourceIcon(type: string) {
  const icons: Record<string, string> = {
    youtube: "YT",
    vimeo: "VM",
    loom: "LM",
    web_article: "WB",
    pdf: "PDF",
    docx: "DOC",
    mp4: "MP4",
    mp3: "MP3",
  };
  return icons[type] || type.slice(0, 3).toUpperCase();
}

/** Muted chips — same family as UI, slight hue shift per type */
function sourceColor(type: string) {
  const colors: Record<string, string> = {
    youtube: "bg-primary/12 text-primary border border-primary/20",
    vimeo: "bg-chart-2/10 text-chart-2 border border-chart-2/20",
    loom: "bg-muted text-foreground/80 border border-border",
    web_article: "bg-secondary text-muted-foreground border border-border",
    pdf: "bg-chart-3/10 text-chart-3 border border-chart-3/20",
    docx: "bg-muted text-foreground/75 border border-border",
    mp4: "bg-chart-2/10 text-chart-2 border border-chart-2/18",
    mp3: "bg-muted text-foreground/75 border border-border",
  };
  return colors[type] || "bg-secondary text-muted-foreground border border-border";
}

type SearchParams = Promise<{ q?: string; type?: string }>;

export default async function ContentPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const typeFilter = sp.type ?? "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  let query = supabase
    .from("content_items")
    .select("id, title, source_type, status, created_at")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }
  if (typeFilter !== "all") {
    query = query.eq("source_type", typeFilter);
  }

  const { data: items, error } = await query;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-800">
        Could not load content: {error.message}
      </div>
    );
  }

  const list = items ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Content Library
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Training sources for AI plan generation.
            {list.length > 0 && (
              <span className="ml-1 font-medium text-muted-foreground">{list.length} items</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button asChild className="shrink-0 rounded-xl">
            <Link href="/dashboard/content/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload new
            </Link>
          </Button>
        )}
      </div>

      {/* Search + Filter */}
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        method="get"
        action="/dashboard/content"
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search by title..."
            defaultValue={q}
            className="h-11 rounded-lg pl-10 text-base"
            aria-label="Search by title"
          />
        </div>
        <div className="flex gap-2">
          <select
            name="type"
            defaultValue={typeFilter}
            className="h-11 rounded-lg border border-border bg-card px-3 text-base text-foreground shadow-[var(--shadow-xs)] transition-all focus:border-primary focus:ring-0"
            aria-label="Filter by source type"
          >
            {SOURCE_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" className="rounded-xl">
            Apply
          </Button>
        </div>
      </form>

      {/* Content grid */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-none">
            <FileVideo className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-5 text-sm font-semibold text-foreground">No content yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {q || typeFilter !== "all"
              ? "Nothing matches your filters. Try clearing search or choosing \u201CAll types.\u201D"
              : isAdmin
                ? "Upload a YouTube link, PDF, document, or media file to get started."
                : "Your org has no training content yet. Ask an admin to upload content."}
          </p>
          {isAdmin && !(q || typeFilter !== "all") && (
            <Button className="mt-6 rounded-xl" asChild>
              <Link href="/dashboard/content/upload">Upload content</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/content/${row.id}`}
              className="group relative rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] hover:border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${sourceColor(row.source_type)}`}>
                  {sourceIcon(row.source_type)}
                </div>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${statusStyle(row.status)}`}>
                  {row.status}
                </span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-foreground">
                {row.title}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
