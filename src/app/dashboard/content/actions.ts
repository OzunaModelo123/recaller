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

export async function ingestContentFile(formData: FormData): Promise<IngestResult> {
  const ctx = await requireAdminOrg();
  if (!ctx.ok) {
    return { ok: false, error: ctx.error };
  }
  const { supabase, userId, orgId } = ctx;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is larger than 500MB." };
  }

  const name = file.name || "upload";
  const lower = name.toLowerCase();
  let sourceType: string;
  let needsWhisper = false;

  if (lower.endsWith(".pdf")) {
    sourceType = "pdf";
  } else if (lower.endsWith(".docx")) {
    sourceType = "docx";
  } else if (lower.endsWith(".mp4")) {
    sourceType = "mp4";
    needsWhisper = true;
  } else if (lower.endsWith(".mp3")) {
    sourceType = "mp3";
    needsWhisper = true;
  } else {
    return {
      ok: false,
      error: "Unsupported file type. Use MP4, MP3, PDF, or DOCX.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!needsWhisper) {
    try {
      const transcript =
        sourceType === "pdf" ? await extractPdfText(buffer) : await extractDocxText(buffer);
      const { data: row, error } = await supabase
        .from("content_items")
        .insert({
          org_id: orgId,
          uploaded_by: userId,
          title: name.replace(/\.[^.]+$/, "") || name,
          source_type: sourceType,
          source_url: null,
          file_path: null,
          transcript,
          status: "ready",
          metadata: { original_filename: name },
        })
        .select("id")
        .single();
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath("/dashboard/content");
      return { ok: true, contentItemId: row!.id, pollStatus: false };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
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
    return { ok: false, error: insErr?.message ?? "Could not create content record." };
  }

  const safeName = name.replace(/[^\w.\-()+ ]/g, "_");
  const storagePath = `${orgId}/${row.id}/${safeName}`;

  const { error: upErr } = await supabase.storage.from("content-files").upload(storagePath, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (upErr) {
    await supabase.from("content_items").delete().eq("id", row.id);
    if (/size|too large|413/i.test(upErr.message)) {
      return {
        ok: false,
        error:
          "Upload rejected (size limit). Supabase free tier caps files around 50MB; upgrade storage or use a smaller file.",
      };
    }
    return { ok: false, error: upErr.message || "Upload to storage failed." };
  }

  const { error: upRowErr } = await supabase
    .from("content_items")
    .update({ file_path: storagePath })
    .eq("id", row.id);

  if (upRowErr) {
    return { ok: false, error: upRowErr.message };
  }

  try {
    await inngest.send({
      name: "content/transcribe.requested",
      data: { contentItemId: row.id },
    });
  } catch (e) {
    console.error("[ingest] inngest.send failed", e);
  }

  revalidatePath("/dashboard/content");
  return { ok: true, contentItemId: row.id, pollStatus: true };
}
