import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes the original binary from `content-files` and clears `content_items.file_path`.
 * Transcript and embeddings stay in Postgres; plan generation only reads `transcript`.
 *
 * @param throwOnStorageError - When true (e.g. Inngest), failed deletes throw so the step retries.
 */
export async function purgeContentSourceFile(
  supabase: SupabaseClient,
  contentItemId: string,
  options: { throwOnStorageError?: boolean } = {},
): Promise<void> {
  const { throwOnStorageError = false } = options;

  const { data: row, error: selErr } = await supabase
    .from("content_items")
    .select("file_path")
    .eq("id", contentItemId)
    .maybeSingle();

  if (selErr) {
    const msg = `[purgeContentSourceFile] select failed ${contentItemId}: ${selErr.message}`;
    console.error(msg);
    if (throwOnStorageError) throw new Error(msg);
    return;
  }

  const path = row?.file_path?.trim();
  if (!path) return;

  const { error: rmErr } = await supabase.storage.from("content-files").remove([path]);
  if (rmErr) {
    const msg = `[purgeContentSourceFile] storage remove failed ${contentItemId}: ${rmErr.message}`;
    console.error(msg);
    if (throwOnStorageError) throw new Error(rmErr.message);
    return;
  }

  const { error: upErr } = await supabase
    .from("content_items")
    .update({ file_path: null })
    .eq("id", contentItemId);

  if (upErr) {
    console.error(
      "[purgeContentSourceFile] file_path clear failed",
      contentItemId,
      upErr.message,
    );
    if (throwOnStorageError) throw new Error(upErr.message);
  }
}
