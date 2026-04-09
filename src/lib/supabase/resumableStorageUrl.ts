/**
 * Resumable (TUS) upload endpoint for Supabase Storage.
 * Default project URLs use `{ref}.supabase.co` → `{ref}.storage.supabase.co`.
 * Custom Supabase domains do not map to `*.storage.supabase.co`; set
 * `NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL` or `NEXT_PUBLIC_SUPABASE_PROJECT_REF`.
 *
 * @see https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */
export function getResumableUploadEndpoint(supabaseUrl: string): string {
  const override = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL?.trim();
  if (override) return override;

  const url = new URL(supabaseUrl);
  const host = url.hostname.toLowerCase();

  const projectRefMatch = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
  if (projectRefMatch) {
    url.hostname = `${projectRefMatch[1]}.storage.supabase.co`;
  } else if (host.endsWith(".storage.supabase.co")) {
    // already the storage API host
  } else {
    const ref = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim();
    if (!ref) {
      throw new Error(
        "Resumable uploads require NEXT_PUBLIC_SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL when NEXT_PUBLIC_SUPABASE_URL uses a custom domain.",
      );
    }
    url.hostname = `${ref}.storage.supabase.co`;
  }

  url.pathname = "/storage/v1/upload/resumable";
  return url.toString();
}
