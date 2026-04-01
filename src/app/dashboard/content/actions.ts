"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractTranscriptFromFile,
  extractTranscriptFromUrl,
  runBackgroundMediaTranscript,
} from "@/lib/content/contentTranscriptService";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
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

  try {
    const extracted = await extractTranscriptFromUrl(trimmed);
    const { data: row, error } = await supabase
      .from("content_items")
      .insert({
        org_id: orgId,
        uploaded_by: userId,
        title: extracted.title ?? "Imported content",
        source_type: extracted.sourceType,
        source_url: trimmed,
        transcript: extracted.transcript,
        status: "ready",
        metadata: extracted.metadata,
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
  | { ok: true; contentItemId: string; storagePath: string; storagePrefix: string }
  | { ok: false; error: string };

export type UploadedContentAsset = {
  path: string;
  bytes: number;
  contentType: string;
  kind: "source_file" | "transcript_audio_segment";
};

function readUploadedAssetPaths(
  metadata: unknown,
): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const assets = (metadata as { uploaded_assets?: unknown }).uploaded_assets;
  if (!Array.isArray(assets)) {
    return [];
  }

  return assets
    .map((asset) => {
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
        return null;
      }

      const path = (asset as { path?: unknown }).path;
      return typeof path === "string" && path.trim() ? path : null;
    })
    .filter((path): path is string => Boolean(path));
}

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
      return { ok: false, error: "File is larger than 2GB." };
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
    const storagePrefix = `${orgId}/${row.id}`;
    const storagePath = `${storagePrefix}/${safeName}`;
    return { ok: true, contentItemId: row.id, storagePath, storagePrefix };
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

export async function abortContentFileUpload(
  contentItemId: string,
  uploadedPaths: string[] = [],
): Promise<{ ok: boolean }> {
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
    const storedPaths = readUploadedAssetPaths(row.metadata);
    await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .remove(Array.from(new Set([storagePath, ...storedPaths, ...uploadedPaths])))
      .catch(() => undefined);
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

    const admin = createAdminClient();
    const { orgId } = ctx;
    const { data: row, error: fetchErr } = await admin
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
    const uploadedAssetPaths = readUploadedAssetPaths(row.metadata);
    const storagePaths = Array.from(
      new Set([
        row.file_path ?? `${orgId}/${contentItemId}/${safeName}`,
        ...uploadedAssetPaths,
      ]),
    );

    const { data: plans, error: plansErr } = await admin
      .from("plans")
      .select("id")
      .eq("org_id", orgId)
      .eq("content_item_id", contentItemId);

    if (plansErr) {
      return { ok: false, error: plansErr.message };
    }

    const planIds = (plans ?? []).map((plan) => plan.id);

    if (planIds.length > 0) {
      const { data: assignments, error: assignmentsErr } = await admin
        .from("assignments")
        .select("id")
        .eq("org_id", orgId)
        .in("plan_id", planIds);

      if (assignmentsErr) {
        return { ok: false, error: assignmentsErr.message };
      }

      const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);

      if (assignmentIds.length > 0) {
        const { error: stepErr } = await admin
          .from("step_completions")
          .delete()
          .in("assignment_id", assignmentIds);
        if (stepErr) {
          return { ok: false, error: stepErr.message };
        }

        const { error: assignmentDeleteErr } = await admin
          .from("assignments")
          .delete()
          .eq("org_id", orgId)
          .in("id", assignmentIds);
        if (assignmentDeleteErr) {
          return { ok: false, error: assignmentDeleteErr.message };
        }
      }

      const { error: planStepErr } = await admin
        .from("plan_steps")
        .delete()
        .in("plan_id", planIds);
      if (planStepErr) {
        return { ok: false, error: planStepErr.message };
      }

      const { error: planEmbeddingErr } = await admin
        .from("plan_embeddings")
        .delete()
        .eq("org_id", orgId)
        .in("plan_id", planIds);
      if (planEmbeddingErr) {
        return { ok: false, error: planEmbeddingErr.message };
      }

      const { error: planDeleteErr } = await admin
        .from("plans")
        .delete()
        .eq("org_id", orgId)
        .in("id", planIds);
      if (planDeleteErr) {
        return { ok: false, error: planDeleteErr.message };
      }
    }

    const { error: contentEmbeddingErr } = await admin
      .from("content_embeddings")
      .delete()
      .eq("org_id", orgId)
      .eq("content_item_id", contentItemId);
    if (contentEmbeddingErr) {
      return { ok: false, error: contentEmbeddingErr.message };
    }

    await admin.storage
      .from(CONTENT_FILES_BUCKET)
      .remove(storagePaths)
      .catch(() => undefined);

    const { error: deleteErr } = await admin
      .from("content_items")
      .delete()
      .eq("id", contentItemId)
      .eq("org_id", orgId);

    if (deleteErr) {
      return { ok: false, error: deleteErr.message };
    }

    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/${contentItemId}`);
    revalidatePath("/dashboard/plans");
    revalidatePath("/dashboard/assignments");
    revalidatePath("/dashboard/team");
    revalidatePath("/dashboard");
    revalidatePath("/employee");
    revalidatePath("/employee/my-plans");
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

export async function finalizeContentFileUpload(
  contentItemId: string,
  uploadedAssets: UploadedContentAsset[] = [],
): Promise<IngestResult> {
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
    const storagePath = uploadedAssets[0]?.path ?? `${orgId}/${contentItemId}/${safeName}`;

    const sourceType = row.source_type;

    if (sourceType === "pdf" || sourceType === "docx") {
      try {
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
        const extracted = await extractTranscriptFromFile(sourceType, buffer);
        const transcript = extracted.mode === "instant" ? extracted.transcript : null;
        if (!transcript) {
          throw new Error("Could not extract text from this file.");
        }
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
      const normalizedMetadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const nextMetadata =
        uploadedAssets.length > 0
          ? {
              ...normalizedMetadata,
              uploaded_assets: uploadedAssets,
            }
          : normalizedMetadata;

      const { error: upRowErr } = await supabase
        .from("content_items")
        .update({ file_path: storagePath, metadata: nextMetadata })
        .eq("id", contentItemId);

      if (upRowErr) {
        console.error("[content] failed to persist media file_path", {
          contentItemId,
          storagePath,
          error: upRowErr.message,
        });
        await supabase.storage
          .from(CONTENT_FILES_BUCKET)
          .remove(uploadedAssets.length > 0 ? uploadedAssets.map((asset) => asset.path) : [storagePath])
          .catch(() => undefined);
        await supabase.from("content_items").delete().eq("id", contentItemId);
        return { ok: false, error: upRowErr.message };
      }

      after(async () => {
        try {
          await runBackgroundMediaTranscript(contentItemId);
        } catch (backgroundError) {
          console.error("[content] background media transcription failed", {
            contentItemId,
            error:
              backgroundError instanceof Error
                ? backgroundError.message
                : String(backgroundError),
          });
        }
      });

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
