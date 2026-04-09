import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/design/page-header";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ContentUploadForm } from "./upload-form";

export default async function ContentUploadPage() {
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
        <PageHeader
          title="Upload content"
          subtitle="Add transcripts from links or files. Most sources process instantly; audio and video files use Whisper in the background."
        />
      </div>

      {isAdmin ? (
        <ContentUploadForm />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            Admin access required
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Only organization admins can upload training content. Ask an admin to
            add items to the library.
          </p>
          <Button asChild variant="outline" className="mt-5 rounded-xl">
            <Link href="/dashboard/content">Back to library</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
