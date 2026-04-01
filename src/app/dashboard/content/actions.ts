"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractArticleText } from "@/lib/content/articleExtractor";
import { detectUrlSource } from "@/lib/content/detectUrlSource";
import { extractDocxText } from "@/lib/content/docxExtractor";
import { extractLoomTranscript } from "@/lib/content/loomExtractor";
import { extractPdfText } from "@/lib/content/pdfExtractor";
import { extractVimeoTranscript } from "@/lib/content/vimeoExtractor";
import { extractYouTubeTranscript } from "@/lib/content/youtubeExtractor";
import { inngest } from "@/lib/inngest/client";

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const CONTENT_FILES_BUCKET = "content-files";

type AdminContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; orgId: string }
  | { ok: false; error: string };

async function requireAdminOrg(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }
  const { data: profile, error: pErr } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
  if (pErr || !profile?.org_id) {
    return { ok: false, error: "No organization found for your account." };
  }
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return { ok: false, error: "Only admins can manage content." };
  }
  return { ok: true, supabase, userId: user.id, orgId: profile.org_id };
}

export type IngestResult =
  | { ok: true; contentItemId: string; pollStatus: boolean }
  | { ok: false; error: string };

export async function ingestContentUrl(url: string): Promise<IngestResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a URL." };
  }

  const ctx = await requireAdminOrg();
  if (!ctx.ok) {
    return { ok: false, error: ctx.error };
  }
  const { supabase, userId, orgId } = ctx;

  const kind = detectUrlSource(trimmed);
  if (!kind) {
    return { ok: false, error: "Could not understand this URL." };
  }

  try {
    if (kind === "youtube") {
      const { transcript, metadata } = await extractYouTubeTranscript(trimmed);
      const title = (metadata.title as string) || "YouTube video";
      const { data: row, error } = await supabase
        .from("content_items")
        .insert({
          org_id: orgId,
          uploaded_by: userId,
          title,
          source_type: "youtube",
          source_url: trimmed,
          transcript,
          status: "ready",
          metadata,
        })
        .select("id")
        .single();
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath("/dashboard/content");
      return { ok: true, contentItemId: row!.id, pollStatus: false };
    }

    if (kind === "vimeo") {
      const transcript = await extractVimeoTranscript(trimmed);
      if (!transcript) {
        return {
          ok: false,
          error: process.env.VIMEO_ACCESS_TOKEN
            ? "No captions on this Vimeo video. Upload the video file for AI transcription."
            : "Vimeo captions require VIMEO_ACCESS_TOKEN in the server environment, or upload the video file for AI transcription.",
        };
      }
      const { data: row, error } = await supabase
        .from("content_items")
        .insert({
          org_id: orgId,
          uploaded_by: userId,
          title: "Vimeo video",
          source_type: "vimeo",
          source_url: trimmed,
          transcript,
          status: "ready",
          metadata: {},
        })
        .select("id")
        .single();
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath("/dashboard/content");
      return { ok: true, contentItemId: row!.id, pollStatus: false };
    }

    if (kind === "loom") {
      const transcript = await extractLoomTranscript(trimmed);
      if (!transcript) {
        return {
          ok: false,
          error:
            "No Loom transcript was found. Upload the recording file for AI transcription.",
        };
      }
      const { data: row, error } = await supabase
        .from("content_items")
        .insert({
          org_id: orgId,
          uploaded_by: userId,
          title: "Loom video",
          source_type: "loom",
          source_url: trimmed,
          transcript,
          status: "ready",
          metadata: {},
        })
        .select("id")
        .single();
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath("/dashboard/content");
      return { ok: true, contentItemId: row!.id, pollStatus: false };
    }

    const transcript = await extractArticleText(trimmed);
    let title = "Web article";
    try {
      const u = new URL(trimmed);
      title = u.hostname.replace(/^www\./, "");
    } catch {
      /* keep default title */
    }
    const { data: row, error } = await supabase
      .from("content_items")
      .insert({
        org_id: orgId,
        uploaded_by: userId,
        title,
        source_type: "web_article",
        source_url: trimmed,
        transcript,
        status: "ready",
        metadata: {},
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/dashboard/content");
    return { ok: true, contentItemId: row!.id, pollStatus: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export type PrepareUploadResult =
  | { ok: true; contentItemId: string; storagePath: string }
  | { ok: false; error: string };

/**
 * Creates the content_items row and returns the storage path. The browser uploads the file
 * directly to Supabase Storage so we stay under Next.js / Vercel Server Action body limits.
 */
export async function prepareContentFileUpload(
  fileName: string,
  fileSize: number,
): Promise<PrepareUploadResult> {
  try {
    const ctx = await requireAdminOrg();
    if (!ctx.ok) {
      return { ok: false, error: ctx.error };
    }
    const { supabase, userId, orgId } = ctx;

    if (!fileName.trim() || fileSize === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }
    if (fileSize > MAX_FILE_BYTES) {
      return { ok: false, error: "File is larger than 500MB." };
    }

    const name = fileName.trim() || "upload";
    const lower = name.toLowerCase();
    let sourceType: string;

    if (lower.endsWith(".pdf")) {
      sourceType = "pdf";
    } else if (lower.endsWith(".docx")) {
      sourceType = "docx";
    } else if (lower.endsWith(".mp4")) {
      sourceType = "mp4";
    } else if (lower.endsWith(".mp3")) {
      sourceType = "mp3";
    } else {
      return {
        ok: false,
        error: "Unsupported file type. Use MP4, MP3, PDF, or DOCX.",
      };
    }

    const { data: row, error: insErr } = await supabase
      .from("content_items")
      .insert({
        org_id: orgId,
        uploaded_by: userId,
        title: name.replace(/\.[^.]+$/, "") || name,
        source_type: sourceType,
        source_url: null,
        file_path: null,
        transcript: null,
        status: "queued",
        metadata: { original_filename: name },
      })
      .select("id")
      .single();

    if (insErr || !row) {
      console.error("[content] failed to create content record", {
        fileName,
        fileSize,
        error: insErr?.message,
      });
      return { ok: false, error: insErr?.message ?? "Could not create content record." };
    }

    const safeName = name.replace(/[^\w.\-()+ ]/g, "_");
    const storagePath = `${orgId}/${row.id}/${safeName}`;
    return { ok: true, contentItemId: row.id, storagePath };
  } catch (error) {
    console.error("[content] prepare upload crashed", {
      fileName,
      fileSize,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: "Could not initialize file upload." };
  }
}

export async function abortContentFileUpload(contentItemId: string): Promise<{ ok: boolean }> {
  try {
    const ctx = await requireAdminOrg();
    if (!ctx.ok) {
      return { ok: false };
    }
    const { supabase, orgId } = ctx;

    const { data: row } = await supabase
      .from("content_items")
      .select("org_id, metadata")
      .eq("id", contentItemId)
      .maybeSingle();

    if (!row || row.org_id !== orgId) {
      return { ok: false };
    }

    const name =
      (row.metadata as { original_filename?: string } | null)?.original_filename ?? "upload";
    const safeName = name.replace(/[^\w.\-()+ ]/g, "_");
    const storagePath = `${orgId}/${contentItemId}/${safeName}`;
    await supabase.storage.from(CONTENT_FILES_BUCKET).remove([storagePath]).catch(() => undefined);
    await supabase.from("content_items").delete().eq("id", contentItemId);
    return { ok: true };
  } catch (error) {
    console.error("[content] abort upload crashed", {
      contentItemId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false };
  }
}

export async function deleteContentItem(
  contentItemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireAdminOrg();
    if (!ctx.ok) {
      return { ok: false, error: ctx.error };
    }

    const { supabase, orgId } = ctx;
    const { data: row, error: fetchErr } = await supabase
      .from("content_items")
      .select("id, org_id, file_path, metadata")
      .eq("id", contentItemId)
      .maybeSingle();

    if (fetchErr || !row || row.org_id !== orgId) {
      return { ok: false, error: "Content item not found." };
    }

    const originalName =
      (row.metadata as { original_filename?: string } | null)?.original_filename ?? "upload";
    const safeName = originalName.replace(/[^\w.\-()+ ]/g, "_");
    const storagePath = row.file_path ?? `${orgId}/${contentItemId}/${safeName}`;

    await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);

    const { error: deleteErr } = await supabase
      .from("content_items")
      .delete()
      .eq("id", contentItemId)
      .eq("org_id", orgId);

    if (deleteErr) {
      return { ok: false, error: deleteErr.message };
    }

    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/${contentItemId}`);
    return { ok: true };
  } catch (error) {
    console.error("[content] delete content crashed", {
      contentItemId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: "Could not delete content." };
  }
}

export async function finalizeContentFileUpload(contentItemId: string): Promise<IngestResult> {
  try {
    const ctx = await requireAdminOrg();
    if (!ctx.ok) {
      return { ok: false, error: ctx.error };
    }
    const { supabase, orgId } = ctx;

    const { data: row, error: fetchErr } = await supabase
      .from("content_items")
      .select("id, org_id, source_type, metadata, status, transcript")
      .eq("id", contentItemId)
      .single();

    if (fetchErr || !row || row.org_id !== orgId) {
      return { ok: false, error: "Content item not found." };
    }

    const name =
      (row.metadata as { original_filename?: string } | null)?.original_filename ?? "upload";
    const safeName = name.replace(/[^\w.\-()+ ]/g, "_");
    const storagePath = `${orgId}/${contentItemId}/${safeName}`;

    const { data: blob, error: dlErr } = await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .download(storagePath);
    if (dlErr || !blob) {
      console.error("[content] storage download failed", {
        contentItemId,
        storagePath,
        error: dlErr?.message,
      });
      return { ok: false, error: dlErr?.message ?? "Uploaded file not found in storage." };
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const sourceType = row.source_type;

    if (sourceType === "pdf" || sourceType === "docx") {
      try {
        const transcript =
          sourceType === "pdf" ? await extractPdfText(buffer) : await extractDocxText(buffer);
        await supabase.storage.from(CONTENT_FILES_BUCKET).remove([storagePath]).catch(() => undefined);
        const { error: upErr } = await supabase
          .from("content_items")
          .update({ transcript, status: "ready", file_path: null })
          .eq("id", contentItemId);
        if (upErr) {
          return { ok: false, error: upErr.message };
        }
        revalidatePath("/dashboard/content");
        return { ok: true, contentItemId, pollStatus: false };
      } catch (e) {
        console.error("[content] document extraction failed", {
          contentItemId,
          sourceType,
          error: e instanceof Error ? e.message : String(e),
        });
        await supabase.storage.from(CONTENT_FILES_BUCKET).remove([storagePath]).catch(() => undefined);
        await supabase.from("content_items").delete().eq("id", contentItemId);
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    if (sourceType === "mp4" || sourceType === "mp3") {
      const { error: upRowErr } = await supabase
        .from("content_items")
        .update({ file_path: storagePath })
        .eq("id", contentItemId);

      if (upRowErr) {
        console.error("[content] failed to persist media file_path", {
          contentItemId,
          storagePath,
          error: upRowErr.message,
        });
        await supabase.storage.from(CONTENT_FILES_BUCKET).remove([storagePath]).catch(() => undefined);
        await supabase.from("content_items").delete().eq("id", contentItemId);
        return { ok: false, error: upRowErr.message };
      }

      const meta = row.metadata;
      const baseMeta =
        meta && typeof meta === "object" && !Array.isArray(meta)
          ? (meta as Record<string, unknown>)
          : {};

      try {
        await inngest.send({
          name: "content/transcribe.requested",
          data: { contentItemId },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[ingest] inngest.send failed", e);
        await supabase
          .from("content_items")
          .update({
            status: "failed",
            metadata: {
              ...baseMeta,
              error: `Transcription job could not be queued: ${message}`,
            },
          })
          .eq("id", contentItemId);
        return {
          ok: false,
          error:
            "Upload succeeded, but background transcription could not be started. Check Inngest configuration and try again.",
        };
      }

      revalidatePath("/dashboard/content");
      return { ok: true, contentItemId, pollStatus: true };
    }

    await supabase.storage.from(CONTENT_FILES_BUCKET).remove([storagePath]).catch(() => undefined);
    await supabase.from("content_items").delete().eq("id", contentItemId);
    return { ok: false, error: "Unexpected content type." };
  } catch (error) {
    console.error("[content] finalize upload crashed", {
      contentItemId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: "Could not finalize uploaded file." };
  }
}
