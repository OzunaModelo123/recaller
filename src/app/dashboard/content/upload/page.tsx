import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
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
      <div>
        <Link
          href="/dashboard/content"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Content library
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-stone-900">
          Upload content
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          Add transcripts from links or files. Most sources process instantly;
          audio and video files use Whisper in the background.
        </p>
      </div>

      {isAdmin ? (
        <ContentUploadForm />
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-50">
            <ShieldAlert className="h-6 w-6 text-stone-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-stone-700">
            Admin access required
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-stone-400">
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
