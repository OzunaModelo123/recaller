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
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    case "queued":
    case "transcribing":
    case "analyzing":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-stone-50 text-stone-600 border-stone-200";
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

function sourceColor(type: string) {
  const colors: Record<string, string> = {
    youtube: "bg-red-50 text-red-600",
    vimeo: "bg-blue-50 text-blue-600",
    loom: "bg-purple-50 text-purple-600",
    web_article: "bg-stone-100 text-stone-600",
    pdf: "bg-orange-50 text-orange-600",
    docx: "bg-sky-50 text-sky-600",
    mp4: "bg-violet-50 text-violet-600",
    mp3: "bg-pink-50 text-pink-600",
  };
  return colors[type] || "bg-stone-50 text-stone-500";
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
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Content Library</h1>
          <p className="mt-1 text-sm text-stone-400">
            Training sources for AI plan generation.
            {list.length > 0 && (
              <span className="ml-1 font-medium text-stone-500">{list.length} items</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button asChild className="shrink-0 rounded-xl bg-stone-900 shadow-sm hover:bg-stone-800">
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
          <Input
            name="q"
            placeholder="Search by title..."
            defaultValue={q}
            className="h-10 rounded-xl border-stone-200 bg-white pl-10 text-sm transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            aria-label="Search by title"
          />
        </div>
        <div className="flex gap-2">
          <select
            name="type"
            defaultValue={typeFilter}
            className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 shadow-sm transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
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
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <FileVideo className="h-6 w-6 text-stone-300" />
          </div>
          <h3 className="mt-5 text-sm font-semibold text-stone-700">No content yet</h3>
          <p className="mt-2 max-w-sm text-sm text-stone-400">
            {q || typeFilter !== "all"
              ? "Nothing matches your filters. Try clearing search or choosing \u201CAll types.\u201D"
              : isAdmin
                ? "Upload a YouTube link, PDF, document, or media file to get started."
                : "Your org has no training content yet. Ask an admin to upload content."}
          </p>
          {isAdmin && !(q || typeFilter !== "all") && (
            <Button className="mt-6 rounded-xl bg-stone-900 shadow-sm hover:bg-stone-800" asChild>
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
              className="group relative rounded-2xl border border-stone-150 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${sourceColor(row.source_type)}`}>
                  {sourceIcon(row.source_type)}
                </div>
                <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-medium ${statusStyle(row.status)}`}>
                  {row.status}
                </span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-medium text-stone-800 group-hover:text-stone-900">
                {row.title}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-stone-300">
                  {new Date(row.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-stone-200 transition-colors group-hover:text-stone-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
