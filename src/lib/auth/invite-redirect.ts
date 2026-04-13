/**
 * `inviteUserByEmail` redirect: hits `/callback` to set cookies, then forwards to `next`.
 * Add `https://YOUR_DOMAIN/callback*` (wildcard) to Supabase Auth → Redirect URLs.
 */
export function buildInviteRedirectTo(baseUrl: string, next: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/callback?next=${encodeURIComponent(next)}`;
}
