/**
 * `inviteUserByEmail` redirect: dedicated client route finishes the session and * hard-navigates to `/employee/setup-password` (or `next`).
 * Add `https://YOUR_DOMAIN/auth/invite*` to Supabase Auth → Redirect URLs.
 */
export function buildInviteRedirectTo(baseUrl: string, next: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/auth/invite?next=${encodeURIComponent(next)}`;
}
